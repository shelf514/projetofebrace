"""Simula o ESP32 enviando leituras reais para o backend (POST /api/readings).

Replica exatamente o payload e o fluxo do firmware (main.cpp), para validar
a API, o WebSocket e o dashboard SEM precisar do hardware.

Uso:
    python scripts/simulate_esp32.py                          # infinito, 1 leitura/2s
    python scripts/simulate_esp32.py --count 10 --interval 1  # 10 leituras, 1s entre elas
    python scripts/simulate_esp32.py --url http://192.168.0.10:8000 --api-key minha-chave
    python scripts/simulate_esp32.py --anomalies              # injeta picos para testar alertas
"""

import argparse
import random
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import httpx  # noqa: E402

DEFAULT_URL = "http://127.0.0.1:8000"
DEFAULT_API_KEY = "change-me"
DEFAULT_DEVICE = "AQUASENSE-SIM"


def build_payload(rng: random.Random, anomalies: bool, device_id: str) -> dict:
    """Gera uma leitura com valores realistas; se anomalies=True, injeta picos."""
    temperature = round(25.0 + rng.gauss(0, 1.5), 1)
    turbidity = round(max(4.0 + rng.gauss(0, 2.5), 0.5), 2)
    tds = round(260.0 + rng.gauss(0, 25), 1)
    if anomalies and rng.random() < 0.06:
        turbidity = round(rng.uniform(300, 700), 2)
        tds = round(rng.uniform(800, 1500), 1)
    return {
        "device_id": device_id,
        "temperature": temperature,
        "turbidity": turbidity,
        "tds": tds,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--url", default=DEFAULT_URL, help="URL do backend (sem barra final)")
    parser.add_argument("--api-key", default=DEFAULT_API_KEY, help="API key configurada no .env do backend")
    parser.add_argument("--device", default=DEFAULT_DEVICE, help="device_id a enviar (criado automaticamente)")
    parser.add_argument("--interval", type=float, default=2.0, help="segundos entre leituras")
    parser.add_argument("--count", type=int, default=0, help="numero de leituras (0 = infinito)")
    parser.add_argument("--anomalies", action="store_true", help="injetar picos de turbidez/TDS para testar alertas")
    parser.add_argument("--seed", type=int, default=None, help="semente aleatoria (reproducao)")
    args = parser.parse_args()

    rng = random.Random(args.seed)
    url = f"{args.url.rstrip('/')}/api/readings"
    headers = {"X-API-Key": args.api_key}
    sent = 0
    failed = 0

    print(f"Simulando ESP32 -> {url} (device={args.device}, interval={args.interval}s)")
    try:
        while args.count == 0 or sent < args.count:
            payload = build_payload(rng, args.anomalies, args.device)
            try:
                response = httpx.post(url, json=payload, headers=headers, timeout=10)
                if response.status_code == 201:
                    sent += 1
                    print(f"[{sent}] OK   temp={payload['temperature']}°C "
                          f"turb={payload['turbidity']} NTU tds={payload['tds']} ppm")
                else:
                    failed += 1
                    print(f"[!] HTTP {response.status_code}: {response.text[:160]}")
            except httpx.HTTPError as exc:
                failed += 1
                print(f"[!] Falha de rede: {exc}")
            if args.count and sent >= args.count:
                break
            time.sleep(args.interval)
    except KeyboardInterrupt:
        print("\nSimulador interrompido pelo usuario.")
    print(f"Concluido: {sent} enviadas, {failed} falhas.")


if __name__ == "__main__":
    main()
