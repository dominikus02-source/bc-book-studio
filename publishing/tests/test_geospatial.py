import unittest

class GeoWorkerSmokeTest(unittest.TestCase):
    def test_project_geometry_without_network(self):
        try:
            import geopandas as gpd
            from shapely.geometry import Point, Polygon
            from pyproj import Transformer
            import cartopy.crs as ccrs
            import pyogrio
        except ImportError:
            self.skipTest('optional GIS dependencies not present')
        feature = gpd.GeoDataFrame(
            {'name':['contoh']}, geometry=[Point(106.8, -6.2)], crs='EPSG:4326')
        result = feature.to_crs(epsg=3857)
        self.assertEqual(result.crs.to_epsg(), 3857)
        self.assertLess(result.geometry.iloc[0].y, 0)
        self.assertGreater(result.geometry.iloc[0].x, 1e7)
        self.assertEqual(len(feature), 1)
        self.assertTrue(Polygon([(0,0),(1,0),(0,1)]).is_valid)
        self.assertIsNotNone(ccrs.PlateCarree())
