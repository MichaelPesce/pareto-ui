"""Small positive-flow examples; no dependency on private map_testing files."""
from pathlib import Path
from app.internal.ExcelApi import WriteMapDataToExcel
from app.internal.scenario_inputs import read_inputs, write_inputs

def map_files(directory):
    """Equivalent three-point maps in both supported import formats."""
    import geopandas as gpd
    from shapely.geometry import Point, LineString
    from zipfile import ZipFile
    directory = Path(directory)
    names = ['P1', 'N1', 'K1']
    coords = [(-103, 34), (-102.99, 34), (-102.98, 34)]
    points = ''.join(f'<Placemark><name>{name}</name><Point><coordinates>{x},{y},0</coordinates></Point></Placemark>'
                     for name, (x, y) in zip(names, coords))
    line = ' '.join(f'{x},{y},0' for x, y in coords)
    kml = directory / 'network.kml'
    kml.write_text(f'<kml xmlns="http://www.opengis.net/kml/2.2"><Document>{points}<Placemark><name>pipe</name><LineString><coordinates>{line}</coordinates></LineString></Placemark></Document></kml>')
    shapes = directory / 'shapes'; shapes.mkdir()
    gpd.GeoDataFrame({'Name': names}, geometry=[Point(c) for c in coords], crs='EPSG:4326').to_file(shapes / 'points.shp')
    gpd.GeoDataFrame({'Name': ['pipe']}, geometry=[LineString(coords)], crs='EPSG:4326').to_file(shapes / 'lines.shp')
    archive = directory / 'network.zip'
    with ZipFile(archive, 'w') as zipped:
        for path in shapes.iterdir():
            zipped.write(path, path.name)
    return kml, archive

def simple_scenario(directory):
    nodes = {'P1': {'node_type': 'ProductionPad', 'coordinates': [-103, 34]},
             'N1': {'node_type': 'NetworkNode', 'coordinates': [-102.99, 34], 'NodeCapacities': 100},
             'K1': {'node_type': 'DisposalSite', 'coordinates': [-102.98, 34], 'InitialDisposalCapacity': 100, 'DisposalOperationalCost': 1}}
    data = {'all_nodes': nodes, 'ProductionPads': {'P1': nodes['P1']}, 'NetworkNodes': {'N1': nodes['N1']},
            'SWDSites': {'K1': nodes['K1']}, 'time_periods': ['T01', 'T02'],
            'arcs': {'pipe': {'diameter': 'D4', 'lengths': [1, 1], 'nodes': [
                {'name': 'P1', 'outgoing_nodes': ['N1']}, {'name': 'N1', 'outgoing_nodes': ['K1']}, {'name': 'K1', 'outgoing_nodes': []}]}},
            'connections': {'all_connections': {'P1': ['N1'], 'N1': ['K1']},
                'connection_metadata': {'P1::N1': {'pipeline_capacity': 100, 'pipeline_length': 1, 'pipeline_diameter': 4},
                                        'N1::K1': {'pipeline_capacity': 100, 'pipeline_length': 1, 'pipeline_diameter': 4}}}}
    path = Path(directory) / 'simple.xlsx'
    WriteMapDataToExcel(data, str(path.with_suffix('')))
    inputs = read_inputs(path, previous={'origin': 'map'}, map_data=data)
    inputs['df_parameters']['PadRates'] = {'ProductionPads': ['P1'], 'T01': [100], 'T02': [100]}
    # This fixture tests existing infrastructure; it cannot buy around a bottleneck.
    inputs['df_sets']['PipelineDiameters'] = ['D0']
    inputs['df_parameters']['PipelineDiameterValues'] = {'PipelineDiameters': ['D0'], 'VALUE': [0]}
    inputs['df_parameters']['PipelineCapacityIncrements'] = {'PipelineDiameters': ['D0'], 'VALUE': [0]}
    write_inputs(inputs, path)
    return {'id': 1, 'name': 'Simple map scenario', 'data_input': inputs,
            'optimization': {'solver': 'cbc', 'waterQuality': 'false', 'hydraulics': 'false', 'pipeline_cost': 'distance_based'},
            'results': {'status': 'Draft'}, 'override_values': {}}, path
