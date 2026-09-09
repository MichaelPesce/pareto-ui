import tempfile
import unittest
from pathlib import Path

import geopandas as gpd
from shapely.geometry import LineString

from app.internal.ShapefileParser import ParseShapefile
from app.internal.util import determineArcsAndConnections, calculate_distance_from_coordinates


class MapImportTests(unittest.TestCase):
    def test_duplicate_shapefile_names_do_not_drop_pipelines(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'pipes.shp'
            gpd.GeoDataFrame({'Name': ['Untitled Path'] * 3}, geometry=[
                LineString([(-103, 34), (-102, 34)]),
                LineString([(-102, 34), (-101, 34)]),
                LineString([(-101, 34), (-100, 34)]),
            ], crs='EPSG:4326').to_file(path)
            data = ParseShapefile(str(path), 'NetworkNode')
        self.assertEqual(set(data['arcs']), {'Untitled Path', 'Untitled Path_', 'Untitled Path__'})

    def test_repeated_nearest_vertices_preserve_bends_and_length_without_self_arcs(self):
        coordinates = [[-103, 34], [-102.99, 34.01], [-102.5, 34.03], [-102, 34]]
        data = {'all_nodes': {'A': {'coordinates': coordinates[0]}, 'B': {'coordinates': coordinates[-1]}},
                'arcs': {'pipe': {'coordinates': coordinates}}}
        result = determineArcsAndConnections(data)
        pipe = result['arcs']['pipe']
        self.assertEqual([n['name'] for n in pipe['nodes']], ['A', 'B'])
        self.assertEqual(pipe['nodes'][0]['segment_coordinates'], coordinates)
        self.assertEqual(result['connections']['all_connections'], {'A': ['B'], 'B': []})
        expected = sum(calculate_distance_from_coordinates(a, b) for a, b in zip(coordinates, coordinates[1:]))
        self.assertAlmostEqual(pipe['lengths'][0], expected)
        # Importing another map must leave existing directions and geometry intact.
        self.assertEqual(determineArcsAndConnections(result), result)


if __name__ == '__main__':
    unittest.main()
