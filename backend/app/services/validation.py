SOFT_BOUNDS = {
    "temperature": (-5.0, 45.0),
    "turbidity": (0.0, 1000.0),
    "tds": (0.0, 2000.0),
}

HARD_BOUNDS = {
    "temperature": (-60.0, 150.0),
    "turbidity": (0.0, 10000.0),
    "tds": (0.0, 10000.0),
}


def is_hard_violation(temperature: float, turbidity: float, tds: float) -> bool:
    values = {"temperature": temperature, "turbidity": turbidity, "tds": tds}
    for name, (low, high) in HARD_BOUNDS.items():
        if not (low <= values[name] <= high):
            return True
    return False


def is_soft_violation(temperature: float, turbidity: float, tds: float) -> bool:
    values = {"temperature": temperature, "turbidity": turbidity, "tds": tds}
    for name, (low, high) in SOFT_BOUNDS.items():
        if not (low <= values[name] <= high):
            return True
    return False
