import unittest
from publishing.ops.vps_preflight import evaluate

class VPSPreflightTest(unittest.TestCase):
    def test_accepts_free_isolated_host(self):
        self.assertEqual([], evaluate(disk_free_gib=50, memory_available_gib=10,
                                     load_one=3, cpus=16, docker_access=True))
    def test_blocks_busy_full_or_unauthorized(self):
        problems = evaluate(disk_free_gib=23, memory_available_gib=9,
                            load_one=13, cpus=16, docker_access=False)
        self.assertEqual(len(problems), 3)
        self.assertTrue(any("disk" in p for p in problems))
        self.assertTrue(any("load" in p for p in problems))
        self.assertTrue(any("docker" in p for p in problems))
