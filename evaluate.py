import json
import time
import requests
import numpy as np
try:
    from bert_score import score
except ImportError:
    print("bert_score tidak ditemukan. Silakan install dengan: pip install bert-score")
    exit(1)

API_URL = "http://localhost:8001/cek-fakta"
DATA_FILE = "data/test_claims.json"

def main():
    print("Memuat dataset testing...")
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    results = []
    correct_verdicts = 0
    total_claims = len(data)
    
    # Untuk BERTScore
    cands = []
    refs = []

    print(f"Mengevaluasi {total_claims} klaim...\n")

    for i, item in enumerate(data):
        klaim = item["klaim"]
        expected_verdict = item["expected_verdict"].upper()
        reference = item["reference"]
        
        print(f"[{i+1}/{total_claims}] Klaim: {klaim}")
        
        # Hit API
        start_time = time.time()
        try:
            resp = requests.post(API_URL, json={"klaim": klaim, "strategi": "cot"})
            resp.raise_for_status()
            res_json = resp.json()
        except Exception as e:
            print(f"  -> Error koneksi ke API: {e}")
            continue
            
        waktu_ms = (time.time() - start_time) * 1000
        verdict = res_json.get("verdict", "").upper()
        penjelasan = res_json.get("penjelasan", "")
        bukti_list = res_json.get("bukti", [])
        
        # 1. Verdict Accuracy
        is_correct = (verdict == expected_verdict)
        if is_correct:
            correct_verdicts += 1
            print(f"  -> Verdict: BENAR ({verdict})")
        else:
            print(f"  -> Verdict: SALAH (Expected: {expected_verdict}, Got: {verdict})")
            
        # 2. Recall@5 Approximation
        # Mengukur apakah reference ada/overlap dengan bukti yang diretriev
        # Secara sederhana, kita hitung token overlap. Jika overlap > 10%, kita anggap "hit".
        hit = False
        ref_tokens = set(reference.lower().split())
        best_overlap = 0
        for b in bukti_list:
            b_tokens = set(b["teks"].lower().split())
            overlap = len(ref_tokens.intersection(b_tokens)) / len(ref_tokens) if len(ref_tokens) > 0 else 0
            if overlap > best_overlap:
                best_overlap = overlap
            if overlap > 0.15: # threshold heuristik 15% token overlap
                hit = True
                
        # 3. Kumpulkan untuk BERTScore
        cands.append(penjelasan)
        refs.append(reference)
        
        results.append({
            "id": item["id"],
            "klaim": klaim,
            "expected_verdict": expected_verdict,
            "actual_verdict": verdict,
            "is_correct": is_correct,
            "hit_at_5": hit,
            "best_overlap": best_overlap,
            "waktu_ms": waktu_ms
        })

    # Hitung metrik agregat
    print("\nMenghitung metrik agregat...")
    accuracy = correct_verdicts / total_claims
    recall_at_5 = sum(1 for r in results if r["hit_at_5"]) / total_claims
    
    # Hitung BERTScore
    print("Menghitung BERTScore (bisa memakan waktu beberapa saat)...")
    P, R, F1 = score(cands, refs, lang="id", verbose=True)
    avg_bert_p = np.mean(P.numpy())
    avg_bert_r = np.mean(R.numpy())
    avg_bert_f1 = np.mean(F1.numpy())
    
    print("\n==================================================")
    print(" HASIL EVALUASI KUANTITATIF (BIOGRAPHY FACT CHECK)")
    print("==================================================")
    print(f"Total Klaim Dievaluasi : {total_claims}")
    print(f"Verdict Accuracy       : {accuracy * 100:.2f}%")
    print(f"Retrieval Recall@5     : {recall_at_5 * 100:.2f}% (approx, token overlap > 15%)")
    print(f"BERTScore Precision    : {avg_bert_p:.4f}")
    print(f"BERTScore Recall       : {avg_bert_r:.4f}")
    print(f"BERTScore F1           : {avg_bert_f1:.4f}")
    print("==================================================")
    
    # Save hasil ke file
    report_file = "eval_results.json"
    with open(report_file, "w", encoding="utf-8") as f:
        json.dump({
            "summary": {
                "total_claims": total_claims,
                "accuracy": accuracy,
                "recall_at_5": recall_at_5,
                "bertscore_f1": float(avg_bert_f1)
            },
            "details": results
        }, f, indent=2)
    print(f"Hasil detail disimpan di {report_file}")

if __name__ == "__main__":
    main()
