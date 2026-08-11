from app.services.validation import is_hard_violation, is_soft_violation


def test_valid_values_no_violation():
    assert is_soft_violation(25.0, 10.0, 200.0) is False
    assert is_hard_violation(25.0, 10.0, 200.0) is False


def test_soft_bounds_temperature():
    assert is_soft_violation(-10.0, 10.0, 200.0) is True
    assert is_soft_violation(60.0, 10.0, 200.0) is True


def test_soft_bounds_turbidity():
    assert is_soft_violation(25.0, 5000.0, 200.0) is True


def test_soft_bounds_tds():
    assert is_soft_violation(25.0, 10.0, 5000.0) is True


def test_hard_bounds_temperature():
    assert is_hard_violation(500.0, 10.0, 200.0) is True
    assert is_hard_violation(-500.0, 10.0, 200.0) is True


def test_hard_bounds_accept_extreme_but_plausible():
    assert is_hard_violation(95.0, 10.0, 200.0) is False


def test_hard_bounds_turbidity():
    assert is_hard_violation(25.0, 20000.0, 200.0) is True


def test_soft_but_not_hard():
    assert is_soft_violation(100.0, 10.0, 200.0) is True
    assert is_hard_violation(100.0, 10.0, 200.0) is False
