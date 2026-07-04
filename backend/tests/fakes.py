"""Test doubles for the backend.

The star here is :class:`FakeMetrolinxService`, a scripted stand-in for
``app.services.metrolinx_service.MetrolinxService``. It mimics only the public
surface that ``LineManager.refresh_trains`` depends on (``get_train_data`` ->
``list[GoTrain]``) and is driven by an ordered, per-cycle sequence of outcomes:

    * a list of ``GoTrain`` payloads (a normal cycle),
    * an empty list (a cycle with no trains), or
    * an ``Exception`` instance (a cycle that fails).

Each call to :meth:`get_train_data` consumes the next entry in the script, so a
sequence such as ``normal -> outage -> recovery`` can be expressed directly.
This is deliberately reusable: later slices script richer scenarios on top of the
same fake.
"""
from __future__ import annotations

from typing import List, Sequence, Union

from app.services.metrolinx_service import GoTrain

# One cycle's scripted outcome: a payload of trains, or an exception to raise.
Outcome = Union[List[GoTrain], Sequence[GoTrain], BaseException]


class FakeMetrolinxService:
    """A programmable fake of ``MetrolinxService`` for tests.

    Parameters
    ----------
    script:
        Ordered outcomes, one consumed per :meth:`get_train_data` call. Omit to
        start empty and set it later with :meth:`set_script`.
    """

    def __init__(
        self,
        script: Sequence[Outcome] | None = None,
        stop_codes_by_trip: dict[str, Sequence[str]] | None = None,
    ) -> None:
        self._script: List[Outcome] = list(script) if script is not None else []
        self.call_count = 0
        # Optional per-trip ordered stop lists returned by get_trip_stop_codes.
        # A trip absent here resolves to [] -- the unresolvable-trip fallback.
        self._stop_codes_by_trip: dict[str, List[str]] = {
            trip: list(codes) for trip, codes in (stop_codes_by_trip or {}).items()
        }

    def set_script(self, script: Sequence[Outcome]) -> "FakeMetrolinxService":
        """Replace the scripted outcomes and reset the cycle counter."""
        self._script = list(script)
        self.call_count = 0
        return self

    def get_train_data(self) -> List[GoTrain]:
        """Return (or raise) the outcome scripted for the current cycle.

        Consumes one entry per call. If an entry is an exception instance it is
        raised; otherwise its payload is returned as a fresh list. Calling more
        times than the script has entries raises ``IndexError`` so over-driving a
        scenario fails loudly instead of silently repeating.
        """
        if self.call_count >= len(self._script):
            raise IndexError(
                f"FakeMetrolinxService script exhausted after {self.call_count} "
                f"cycle(s); scripted {len(self._script)} outcome(s)."
            )

        outcome = self._script[self.call_count]
        self.call_count += 1

        if isinstance(outcome, BaseException):
            raise outcome
        return list(outcome)

    def get_trip_stop_codes(self, trip_number: str, service_date: str) -> List[str]:
        """Return the scripted ordered stop codes for a trip, or [] if none.

        Mirrors the real service's contract: an unknown trip resolves to an empty
        list (the graceful-degradation path) rather than raising.
        """
        return list(self._stop_codes_by_trip.get(trip_number, []))
