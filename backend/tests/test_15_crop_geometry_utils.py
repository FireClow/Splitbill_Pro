"""
Unit tests for crop geometry helper utilities.
"""

import pytest

from server import (
    calculate_polygon_area,
    is_self_intersecting_quadrilateral,
    normalize_crop_points,
    validate_crop_quadrilateral,
)


def test_normalize_crop_points_returns_tl_tr_br_bl_order():
    shuffled = [
        (220.0, 80.0),   # tr
        (35.0, 200.0),   # bl
        (210.0, 210.0),  # br
        (40.0, 70.0),    # tl
    ]

    ordered = normalize_crop_points(shuffled)

    assert ordered[0] == (40.0, 70.0)   # tl
    assert ordered[1] == (220.0, 80.0)  # tr
    assert ordered[2] == (210.0, 210.0) # br
    assert ordered[3] == (35.0, 200.0)  # bl


def test_normalize_crop_points_requires_exactly_four_points():
    with pytest.raises(ValueError, match="exactly 4 points"):
        normalize_crop_points([(0.0, 0.0), (1.0, 1.0), (2.0, 2.0)])


def test_polygon_area_is_positive_for_valid_quad():
    points = [(0.0, 0.0), (10.0, 1.0), (9.0, 9.0), (1.0, 8.0)]
    area = calculate_polygon_area(points)
    assert area > 0


def test_self_intersecting_quad_detected():
    # Bow-tie polygon.
    points = [(0.0, 0.0), (10.0, 10.0), (0.0, 10.0), (10.0, 0.0)]
    assert is_self_intersecting_quadrilateral(points) is True


def test_validate_crop_quadrilateral_rejects_small_area():
    tiny = [(0.0, 0.0), (2.0, 0.0), (2.0, 2.0), (0.0, 2.0)]
    with pytest.raises(ValueError, match="area is too small"):
        validate_crop_quadrilateral(tiny)


def test_validate_crop_quadrilateral_accepts_valid_shape():
    valid = [(20.0, 10.0), (220.0, 20.0), (210.0, 230.0), (30.0, 210.0)]
    validate_crop_quadrilateral(valid)
