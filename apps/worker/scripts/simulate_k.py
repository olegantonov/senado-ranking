#!/usr/bin/env python3
"""
Simula shrinkage do IDS com diferentes valores de K sobre o snapshot atual.

Aplica:  dim_ajustada = (dim × meses + media_dim × K) / (meses + K)
Recalcula ids_total = média ponderada das dimensões ajustadas (mesmos pesos da v2).

Compara top10 e bottom10 entre K=0 (atual), 6, 12, 18, 24.
"""
import sqlite3
from typing import Dict, List

DB = "/home/daniel/observasenado-runtime/data/senado.db"

# Pesos das dimensões IDS v2 (de docs/ANALISE_METODOLOGIA_v2.md)
PESOS = {
    "dim_produtividade": 0.20,
    "dim_efetividade":   0.24,
    "dim_participacao":  0.20,
    "dim_fiscalizacao":  0.12,
    "dim_ceap":          0.12,
    "dim_transparencia": 0.12,
}

def fetch_latest(conn) -> List[dict]:
    snap = conn.execute("SELECT MAX(computed_at) FROM ranking_snapshots").fetchone()[0]
    rows = conn.execute(f"""
        SELECT senador_cod, nome, partido, uf, meses_ativos, ids_total,
               dim_produtividade, dim_efetividade, dim_participacao,
               dim_fiscalizacao, dim_ceap, dim_transparencia
        FROM ranking_snapshots WHERE computed_at = ?
        ORDER BY ids_total DESC
    """, (snap,)).fetchall()
    cols = [d[0] for d in conn.execute(
        f"SELECT * FROM ranking_snapshots WHERE computed_at='{snap}' LIMIT 1"
    ).description]
    return [dict(zip(cols, r)) for r in rows] if False else [
        dict(zip(["senador_cod","nome","partido","uf","meses_ativos","ids_total",
                  "dim_produtividade","dim_efetividade","dim_participacao",
                  "dim_fiscalizacao","dim_ceap","dim_transparencia"], r))
        for r in rows
    ]

def apply_shrinkage(senadores: List[dict], K: int) -> List[dict]:
    if K == 0:
        out = []
        for s in senadores:
            s2 = dict(s)
            s2["ids_total_adj"] = s["ids_total"]
            out.append(s2)
        return out

    # Médias por dimensão (sobre toda a população)
    medias = {}
    for dim in PESOS:
        medias[dim] = sum(s[dim] for s in senadores) / len(senadores)

    out = []
    for s in senadores:
        n = max(s["meses_ativos"], 0)
        dims_adj = {}
        for dim, peso in PESOS.items():
            raw = s[dim]
            adj = (raw * n + medias[dim] * K) / (n + K)
            dims_adj[dim + "_adj"] = adj
        ids_adj = sum(dims_adj[d + "_adj"] * w for d, w in PESOS.items())
        s2 = dict(s)
        s2.update(dims_adj)
        s2["ids_total_adj"] = round(ids_adj, 1)
        out.append(s2)
    return out

def fmt_row(rank: int, s: dict) -> str:
    nome = s["nome"][:24]
    return (f"  {rank:2d}. {nome:<24} {s['partido']:<13} {s['uf']:<3} "
            f"m={s['meses_ativos']:>2} ids={s['ids_total_adj']:>5.1f}")

def main():
    conn = sqlite3.connect(DB)
    snap = fetch_latest(conn)
    print(f"Snapshot: {len(snap)} senadores\n")

    Ks = [0, 6, 12, 18, 24]
    results = {K: sorted(apply_shrinkage(snap, K),
                         key=lambda x: -x["ids_total_adj"]) for K in Ks}

    # Lado a lado: top 10 por K
    print("=" * 70)
    print("TOP 10 por K")
    print("=" * 70)
    for K in Ks:
        label = "atual (sem shrinkage)" if K == 0 else f"K={K}"
        print(f"\n--- {label} ---")
        for i, s in enumerate(results[K][:10], 1):
            print(fmt_row(i, s))

    # Bottom 10
    print()
    print("=" * 70)
    print("BOTTOM 10 por K")
    print("=" * 70)
    for K in Ks:
        label = "atual (sem shrinkage)" if K == 0 else f"K={K}"
        print(f"\n--- {label} ---")
        for i, s in enumerate(results[K][-10:], len(results[K]) - 9):
            print(fmt_row(i, s))

    # Senadores de interesse específico — mostrar como mudam
    print()
    print("=" * 70)
    print("Casos de interesse (mostra posição em cada K)")
    print("=" * 70)
    interesse = ["Esperidião Amin","Jussara Lima","Camilo Santana","Renan Filho",
                 "Hermes Klann","Carlos Portinho","Giordano","Roberta Acioly",
                 "Davi Alcolumbre","Paulo Paim","Damares Alves","Ivete da Silveira"]
    print(f"\n{'nome':<26} {'meses':>5} | " + " | ".join(
        ("atual" if K==0 else f"K={K}").rjust(13) for K in Ks))
    for nome in interesse:
        line = f"{nome:<26} "
        # meses (consistente entre Ks)
        ref = [s for s in snap if s["nome"] == nome]
        if not ref:
            line += "(não encontrado)"
            print(line)
            continue
        line += f"{ref[0]['meses_ativos']:>5} | "
        cells = []
        for K in Ks:
            ranked = results[K]
            pos = next((i for i,s in enumerate(ranked,1) if s["nome"] == nome), None)
            ids = next((s["ids_total_adj"] for s in ranked if s["nome"] == nome), None)
            cells.append(f"#{pos:>2} ids={ids:>5.1f}")
        line += " | ".join(c.rjust(13) for c in cells)
        print(line)

    # Stats: variância da reordenação
    print()
    print("=" * 70)
    print("Mudança de posição vs atual (sem shrinkage)")
    print("=" * 70)
    base_pos = {s["nome"]: i for i,s in enumerate(results[0],1)}
    for K in [6, 12, 18, 24]:
        delta_pos = []
        for i,s in enumerate(results[K],1):
            if s["nome"] in base_pos:
                delta_pos.append(abs(i - base_pos[s["nome"]]))
        avg = sum(delta_pos)/len(delta_pos)
        mx = max(delta_pos)
        print(f"  K={K}: deslocamento médio = {avg:.1f} posições, máximo = {mx}")

if __name__ == "__main__":
    main()
