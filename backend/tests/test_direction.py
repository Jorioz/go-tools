"""Direction resolution, including truncated service-change trips (issue #5).

The synthetic Milton line places UN@0.0, KP@0.5, ML@1.0. Direction is derived
from how far a trip's origin and destination sit from Union's own position on
the line, so a trip that never touches Union still resolves correctly.
"""
from __future__ import annotations

from app.constants import LINE_CODES
from app.services.train_manager import Direction, TrainManager

from tests.factories import build_synthetic_line


def _manager() -> TrainManager:
    return TrainManager(
        line_contexts={LINE_CODES.MILTON: build_synthetic_line(LINE_CODES.MILTON)}
    )


def _direction(first_stop_code: str, last_stop_code: str) -> Direction:
    manager = _manager()
    line = manager.line_contexts[LINE_CODES.MILTON]
    return manager._get_direction(first_stop_code, last_stop_code, line)


def test_trip_leaving_union_is_from_union() -> None:
    assert _direction("UN", "ML") == Direction.FROM_UNION


def test_trip_terminating_at_union_is_to_union() -> None:
    assert _direction("ML", "UN") == Direction.TO_UNION


def test_truncated_trip_away_from_union_is_from_union() -> None:
    # Service change: no service between KP and Union, train runs KP -> ML only.
    # Neither endpoint is Union, and it heads farther from Union.
    assert _direction("KP", "ML") == Direction.FROM_UNION


def test_truncated_trip_toward_union_is_to_union() -> None:
    # The mirror image: ML -> KP never touches Union but heads toward it. The old
    # "first stop is Union" check wrongly called every non-Union origin TO_UNION;
    # here it happens to agree, but the point is direction is decided by movement
    # toward Union, not by an assumed Union endpoint.
    assert _direction("ML", "KP") == Direction.TO_UNION


def test_unknown_origin_falls_back_to_union_heuristic() -> None:
    # A stop code absent from the line (e.g. a bus-substitution code) can't be
    # positioned, so direction falls back to the origin-is-Union heuristic.
    assert _direction("XX", "ML") == Direction.TO_UNION
    assert _direction("UN", "XX") == Direction.FROM_UNION
