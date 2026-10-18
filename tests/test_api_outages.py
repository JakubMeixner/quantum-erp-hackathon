"""Regression tests for machine outages and API integration."""

import copy
import unittest

from fastapi.testclient import TestClient

from api import app
from quantum_erp.io import factory_from_payload
from quantum_erp.model import validate
from quantum_erp.qubo import build_qubo


COMPACT = {
    "jobs": ["Z1", "Z2", "Z3"],
    "machines": ["T", "F", "S"],
    "durations": {
        "Z1": {"T": 2, "F": 1, "S": 2},
        "Z2": {"T": 1, "F": 2, "S": 1},
        "Z3": {"T": 2, "F": 2, "S": 1},
    },
    "outages": [
        {"machine": "F", "start": 2, "end": 4}
    ],
}


def canonical():
    return {
        "problem": "erp_scheduling",
        "jobs": [
            {
                "id": job,
                "operations": [
                    {
                        "machine": machine,
                        "duration": COMPACT["durations"][job][machine],
                    }
                    for machine in COMPACT["machines"]
                ],
            }
            for job in COMPACT["jobs"]
        ],
        "outages": copy.deepcopy(COMPACT["outages"]),
    }


class OutageAPITests(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_both_json_formats_enforce_outage(self):
        for payload in (COMPACT, canonical()):
            with self.subTest(payload=payload.get("problem", "compact")):
                response = self.client.post("/solver", json=payload)

                self.assertEqual(
                    response.status_code, 200, response.text
                )

                result = response.json()
                self.assertEqual(result["makespan"], 10)

                factory = factory_from_payload(payload)
                self.assertEqual(
                    validate(factory, result["schedule"]), 10
                )

                for op in result["schedule"]:
                    if op["machine"] == "F":
                        self.assertTrue(
                            op["end"] <= 2 or op["start"] >= 4,
                            op,
                        )

    def test_baseline_without_outage_remains_eight_hours(self):
        payload = canonical()
        del payload["outages"]

        response = self.client.post("/solver", json=payload)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["makespan"], 8)

    def test_invalid_outages_are_rejected(self):
        invalid = [
            {"machine": "F", "start": 4, "end": 2},
            {"machine": "UNKNOWN", "start": 2, "end": 4},
            {"machine": "F", "start": 2.5, "end": 4},
            {"machine": "F", "start": True, "end": 4},
        ]

        for outage in invalid:
            with self.subTest(outage=outage):
                payload = canonical()
                payload["outages"] = [outage]

                response = self.client.post("/solver", json=payload)
                self.assertEqual(
                    response.status_code, 422, response.text
                )

        payload = canonical()
        payload["outages"] = [
            {"machine": "F", "start": 1, "end": 3},
            {"machine": "F", "start": 2, "end": 4},
        ]

        self.assertEqual(
            self.client.post("/solver", json=payload).status_code,
            422,
        )

    def test_outage_boundaries_and_qubo_pruning(self):
        factory = factory_from_payload(COMPACT)

        # Touching outage boundaries is allowed.
        self.assertTrue(factory.operation_is_available(1, 0, 2))
        self.assertTrue(factory.operation_is_available(1, 4, 2))

        # Intersecting the outage is forbidden.
        self.assertFalse(factory.operation_is_available(1, 1, 2))
        self.assertFalse(factory.operation_is_available(1, 3, 2))

        qubo = build_qubo(factory, 10)
        self.assertEqual(len(qubo.variables), 50)

        for j, k, t in qubo.variables:
            self.assertTrue(
                factory.operation_is_available(
                    k, t, factory.durations[j][k]
                )
            )

    def test_multiple_disjoint_outages(self):
        payload = canonical()
        payload["outages"] = [
            {"machine": "F", "start": 1, "end": 2},
            {"machine": "F", "start": 7, "end": 9},
        ]

        factory = factory_from_payload(payload)

        self.assertEqual(
            factory.downtime(1),
            ((1, 2), (7, 9)),
        )

        qubo = build_qubo(factory, 14)

        for j, k, t in qubo.variables:
            self.assertTrue(
                factory.operation_is_available(
                    k, t, factory.durations[j][k]
                )
            )

    def test_original_invalid_schedule_is_rejected(self):
        # Reproduce a schedule obtained WITHOUT transmitting the outage.
        payload = canonical()
        del payload["outages"]

        response = self.client.post("/solver", json=payload)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["makespan"], 8)

        # Evaluate that same schedule against the intended factory.
        factory = factory_from_payload(COMPACT)

        with self.assertRaisesRegex(ValueError, "outage"):
            validate(factory, response.json()["schedule"])


if __name__ == "__main__":
    unittest.main()
