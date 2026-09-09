import './NetworkMap.css';
import React, { useState, useEffect, useRef } from "react";
import type { NetworkMapProps } from '../../types';
import type { LatLngBoundsExpression as LLBoundsExpr } from 'leaflet';
import { MapContainer, TileLayer, Marker, Polyline, useMapEvents, useMap } from 'react-leaflet';
import { LatLngBoundsExpression, LatLngBounds, LatLng, divIcon } from 'leaflet'
import { Box, Grid, Tabs, Tab, Button } from '@mui/material';
import type { CoordinateTuple } from '../../types';
import { Tooltip } from 'react-leaflet'
import {
    NetworkNodeTypes,
    formatCoordinatesFromNodes,
    convertMapDataToFrontendFormat,
    convertMapDataToBackendFormat,
    getAllowedPipelineConnectionCandidates,
} from '../../util';
import { useMapValues } from '../../context/MapContext';

// h = roads only
// m = standard roadmap
// p = terrain
// r = somehow altered roadmap
// s = satellite only
// t = terrain only
// y = hybrid
// ESRI map tile options: https://sites.google.com/a/blocoware.com/speedohelp/home/map-sources

// TILELAYER OPTIONS: https://leaflet-extras.github.io/leaflet-providers/preview/
// https://openmaptiles.org/styles/

const iconUrl = "http://maps.google.com/mapfiles/kml/"
const PIPELINE_COLOR = "#A03232"
const SELECTED_HIGHLIGHT_COLOR = "#FFD54F"
const DRAFT_PIPELINE_COLOR = "#F28C28"
const SHOW_PIPELINE_FLOW_ARROWS = true
const FLOW_ARROW_ICON_SIZE = 18
const FLOW_ARROW_TARGET_RATIO = 0.92
const SELECTED_POINT_HALO_SIZE = 56
const SELECTED_POINT_ICON = divIcon({
    className: "",
    html: `<div style="
        width:${SELECTED_POINT_HALO_SIZE}px;
        height:${SELECTED_POINT_HALO_SIZE}px;
        border-radius:999px;
        background:radial-gradient(circle, rgba(255, 213, 79, 0.58) 0%, rgba(255, 213, 79, 0.38) 55%, rgba(255, 213, 79, 0.08) 100%);
        filter:blur(1.2px);
    "></div>`,
    iconSize: [SELECTED_POINT_HALO_SIZE, SELECTED_POINT_HALO_SIZE],
    iconAnchor: [SELECTED_POINT_HALO_SIZE / 2, SELECTED_POINT_HALO_SIZE / 2],
})

type LatLngPair = [number, number];
type SegmentPositions = [LatLngPair, LatLngPair];

const hasFlowBetweenNodes = (nodes: any[] = [], fromIdx: number, toIdx: number): boolean => {
    const fromNode = nodes?.[fromIdx];
    const toNode = nodes?.[toIdx];
    if (!fromNode?.name || !toNode?.name) return false;
    return Array.isArray(fromNode.outgoing_nodes) && fromNode.outgoing_nodes.includes(toNode.name);
};

const toLatLngPair = (coords?: Array<number | string>): LatLngPair | null => {
    if (!Array.isArray(coords) || coords.length < 2) return null;
    const lng = Number(coords[0]);
    const lat = Number(coords[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return [lat, lng];
};

const areLatLngPairsEqual = (left?: LatLngPair | null, right?: LatLngPair | null): boolean => {
    if (!left || !right) return false;
    return left[0] === right[0] && left[1] === right[1];
};

const areSegmentsEqual = (left?: SegmentPositions, right?: SegmentPositions): boolean => {
    if (!left || !right) return false;
    return areLatLngPairsEqual(left[0], right[0]) && areLatLngPairsEqual(left[1], right[1]);
};

const getLineSegments = (line?: any): SegmentPositions[] => {
    const positions = formatCoordinatesFromNodes(line?.nodes || []).filter((coords: number[]) =>
        Array.isArray(coords) &&
        coords.length === 2 &&
        Number.isFinite(coords[0]) &&
        Number.isFinite(coords[1])
    ) as LatLngPair[];

    return positions.slice(0, -1).map((position, idx) => [position, positions[idx + 1]]);
};

const getDraftSegments = (draftLine?: any, savedLine?: any): SegmentPositions[] => {
    const draftSegments = getLineSegments(draftLine);
    const savedSegments = getLineSegments(savedLine);

    return draftSegments.filter((segment, idx) => !areSegmentsEqual(segment, savedSegments[idx]));
};

const getFlowArrowIcon = (rotationDeg: number) => divIcon({
    className: "flow-arrow-marker",
    html: `<div class="flow-arrow-glyph" style="transform: rotate(${rotationDeg}deg)">▲</div>`,
    iconSize: [FLOW_ARROW_ICON_SIZE, FLOW_ARROW_ICON_SIZE],
    iconAnchor: [FLOW_ARROW_ICON_SIZE / 2, FLOW_ARROW_ICON_SIZE / 2],
});

const getFlowArrowsForLine = (line: any, lineIndex: number) => {
    const nodes = Array.isArray(line?.nodes) ? line.nodes : [];
    const arrows: Array<{ key: string; position: LatLngPair; rotation: number }> = [];

    for (let idx = 0; idx < nodes.length - 1; idx += 1) {
        const fromCoords = toLatLngPair(nodes[idx]?.coordinates);
        const toCoords = toLatLngPair(nodes[idx + 1]?.coordinates);
        if (!fromCoords || !toCoords) continue;

        const hasDownFlow = hasFlowBetweenNodes(nodes, idx, idx + 1);
        const hasUpFlow = hasFlowBetweenNodes(nodes, idx + 1, idx);
        const showDownFlow = hasDownFlow;
        const showUpFlow = hasUpFlow;

        const pushArrow = (source: LatLngPair, target: LatLngPair, key: string) => {
            const [sourceLat, sourceLng] = source;
            const [targetLat, targetLng] = target;
            const lat = sourceLat + (targetLat - sourceLat) * FLOW_ARROW_TARGET_RATIO;
            const lng = sourceLng + (targetLng - sourceLng) * FLOW_ARROW_TARGET_RATIO;
            const rotation = (Math.atan2(-(targetLat - sourceLat), targetLng - sourceLng) * 180) / Math.PI + 90;
            arrows.push({
                key,
                position: [lat, lng],
                rotation,
            });
        };

        if (showDownFlow) {
            const route = nodes[idx]?.segment_coordinates;
            const beforeEnd = route?.length > 1 ? toLatLngPair(route[route.length - 2]) : null;
            pushArrow(beforeEnd || fromCoords, toCoords, `${lineIndex}:${idx}:down`);
        }
        if (showUpFlow) {
            const route = nodes[idx]?.segment_coordinates;
            const afterStart = route?.length > 1 ? toLatLngPair(route[1]) : null;
            pushArrow(afterStart || toCoords, fromCoords, `${lineIndex}:${idx}:up`);
        }
    }

    return arrows;
};

export default function NetworkMap(props: NetworkMapProps) {
    const { map_data, interactive = false, showMapTypeToggle = false, width = 100, height = 50 } = props;
    const {
        all_nodes: points,
        arcs: lines,
    } = map_data || {};
    const { 
        lineData,
        setLineData,
        nodeData,
        setNodeData,
        clickNode: handleClickNode,
        clickPipeline: handleClickPipeline,
        handleMapClick,
        creatingNewNode,
        selectedNode,
        setNetworkMapData,
        selectingPipelineConnectionFromMap,
        pipelineConnectionSelectionIndex,
        availableNodes,
    } = useMapValues();
    const selectedNodeData = selectedNode?.node ?? (selectedNode as any);
    const selectedNodeType = selectedNodeData?.node_type;
    const selectedNodeIdx = typeof selectedNode?.idx === "number" ? selectedNode.idx : undefined;
    const isPathSelected = selectedNodeType === "path";
    const [ googleMapType, setGoogleMapType ] = useState<string>('y')
    const [ mapCenter, setMapCenter ] = useState<[number, number]>([38, -98])
    const [ mapZoom, setMapZoom ] = useState<number>(5)
    const [ showMap, setShowMap ] = useState<boolean>(false)
    const [ mapBounds, setMapBounds ] = useState<LLBoundsExpr>(
        [// southwest, northeast
            [25.6866,-127.4969],
            [50.7207, -66.0633]
        ])


    function CustomCursorControl() {
        const map = useMap();

        useEffect(() => {
            let cursor = ""
            if (creatingNewNode) {
                const node_type = selectedNode?.node?.nodeType;
                const img_url = NetworkNodeTypes?.[node_type]?.iconUrl;
                if (img_url) {
                    const img = new Image();
                        img.onload = () => {
                        const iconWidth = img.width;
                        const iconHeight = img.height;
                        cursor = `url('${img_url}') ${iconWidth/2} ${iconHeight/2}, auto`;
                        container.style.cursor = cursor;
                    };
                    img.src = img_url;
                }
            }
            const container = map.getContainer();
            container.style.cursor = cursor;

            // Optional: restore on cleanup
            return () => {
            container.style.cursor = "";
            };
        }, [map, creatingNewNode, selectedNode]);

        return null; // This is just a behavior component
    }


    const markerRefs = useRef({});

    const styles: Record<string, React.CSSProperties> = {
        legendBox: {
            paddingTop: 20, 
            paddingRight: 20, 
            position: 'absolute', 
            bottom: 25, 
            left: 25, 
            zIndex: 10000, 
            borderRadius: 8, 
            backgroundColor:'rgba(255,255,255,0.5)', 
            boxShadow:'0px 5px 10px 0px rgba(0, 0, 0, 0.5)'
        },
        mapTypeToggle: {
            paddingTop: 20, 
            paddingRight: 20, 
            borderRadius: 3, 
        }
    }

    const css = `
        .leaflet-container {
            width: ${width}%;
            height: ${height}vh;
            z-index: 0;
        }
        .leaflet-interactive:focus {
            outline: none;
        }
    `

    function MapClickHandler({ onClick }: { onClick: (coords: CoordinateTuple) => void }) {
    useMapEvents({
        click(e) {
        const { lat, lng } = e.latlng; // coordinates
        onClick([lng, lat]);
        },
    });
    return null; // This component doesn't render anything visible
    }


    // NOTEWORTHY: MY COORDINATES ARE REVERSED FROM HOW LEAFLET WANTS THEM
    useEffect(() => {

        //try setting map bounds
        let bound1 = new LatLng(25.6866,-127.4969)
        let bound2 = new LatLng(50.7207, -66.0633)
        let bounds = new LatLngBounds(bound1, bound2)
        // console.log(bounds)

        const [tempNodeData, tempLineDatas, tempMapCenter] = 
            convertMapDataToFrontendFormat({
                all_nodes: points,
                arcs: lines
            })
        setLineData(tempLineDatas)
        setNodeData(tempNodeData.sort((a,b) => a.name.localeCompare(b.name)))
        setMapCenter(tempMapCenter)
        setMapZoom(11)
        setMapBounds(bounds)
        setShowMap(true)
        setNetworkMapData(map_data);

    }, [map_data])

    const getPipelineConnectionTooltip = (candidateNode: any): string => {
        if (!selectingPipelineConnectionFromMap || selectedNodeData?.node_type !== "path") {
            return candidateNode?.name || "";
        }

        const pipelineNodes = selectedNodeData?.nodes || [];
        const allowedCandidates = getAllowedPipelineConnectionCandidates(availableNodes, pipelineNodes, pipelineConnectionSelectionIndex);
        if (allowedCandidates.some((node) => node.name === candidateNode?.name)) {
            return `Add ${candidateNode.name} as connection`;
        }

        return `${candidateNode?.name || "This node"} cannot connect at this position. Check the adjacent node types.`;
    };

    return (
        <Box sx={{ px: 4, pb: 5, pt: 3 }}>
            <style>{css}</style>
            <Grid container>
                <Grid item xs={6}>
                {showMapTypeToggle &&
                    <Box sx={{ p:1 }}>
                        <MapTypeToggle updateMapType={setGoogleMapType} style={styles.mapTypeToggle}/>
                    </Box>
                }
                
                </Grid>
                <Grid item xs={2}></Grid>
                <Grid item xs={4}>
                    
                </Grid>
            </Grid>
            
            
            <Box>
                {showMap && 
                    <MapContainer {...({
                        center: mapCenter,
                        zoom: mapZoom,
                        maxBounds: mapBounds,
                        minZoom: 5,
                        scrollWheelZoom: interactive,
                        doubleClickZoom: interactive,
                        closePopupOnClick: interactive,
                        dragging: interactive,
                        zoomSnap: interactive,
                        zoomDelta: interactive,
                        zoomControl: interactive,
                        touchZoom: interactive,
                    } as any)}>
                        <CustomCursorControl/>
                    <TileLayer {...({
                        attribution: '&amp;copy <a href="http://osm.org/copyright">OpenStreetMap</a> contributors',
                        url: `https://{s}.google.com/vt/lyrs=${googleMapType}&hl=en&x={x}&y={y}&z={z}`,
                        subdomains: ['mt1','mt2','mt3']
                    } as any)} />
                    <MapClickHandler onClick={handleMapClick} />
        
                    {nodeData.map((value, index) => {
                        const markerPosition: [number, number] = [
                            Number(value.coordinates[1]),
                            Number(value.coordinates[0]),
                        ];
                        const isSelectedPoint = !isPathSelected && (
                            (selectedNodeIdx !== undefined && selectedNodeIdx === index) ||
                            (selectedNodeIdx === undefined && selectedNodeData?.name === value.name)
                        );

                        return (
                            <React.Fragment key={index}>
                                {isSelectedPoint && (
                                    <Marker
                                        position={markerPosition}
                                        {...({
                                            icon: SELECTED_POINT_ICON,
                                            interactive: false,
                                            bubblingMouseEvents: false,
                                            keyboard: false,
                                            zIndexOffset: -1000,
                                        } as any)}
                                    />
                                )}
                                <Marker
                                    position={markerPosition}                        
                                    {...({ icon: NetworkNodeTypes[value.nodeType]?.icon } as any)}
                                    eventHandlers={{
                                        click: (e: any) => {
                                            e.originalEvent.stopPropagation();
                                            handleClickNode(value, index);
                                        }
                                    }}
                                    ref={(el) => {
                                        const markerId = `node:${index}`
                                        if (el) {
                                            markerRefs.current[markerId] = el;
                                        }
                                    }}
                                >
                                    <Tooltip>{getPipelineConnectionTooltip(value)}</Tooltip>
                                </Marker>
                            </React.Fragment>
                        )
                    })}
        
        
                    {lineData.map((value, index) => {
                        const isSelectedLine = isPathSelected && (
                            (selectedNodeIdx !== undefined && selectedNodeIdx === index) ||
                            (selectedNodeIdx === undefined && selectedNodeData?.name === value.name)
                        );
                        const linePositions = formatCoordinatesFromNodes(value.nodes);
                        const flowArrows = SHOW_PIPELINE_FLOW_ARROWS ? getFlowArrowsForLine(value, index) : [];

                        return (
                            <React.Fragment key={index}>
                                {isSelectedLine && (
                                    <React.Fragment>
                                        <Polyline
                                            pathOptions={{ 
                                                color: SELECTED_HIGHLIGHT_COLOR,
                                                weight: 16,
                                                opacity: 0.16,
                                                lineCap: "round",
                                                lineJoin: "round",
                                                bubblingMouseEvents: false,
                                                interactive: false,
                                            }}
                                            positions={linePositions}
                                        />
                                        <Polyline
                                            pathOptions={{ 
                                                color: SELECTED_HIGHLIGHT_COLOR,
                                                weight: 11,
                                                opacity: 0.28,
                                                lineCap: "round",
                                                lineJoin: "round",
                                                bubblingMouseEvents: false,
                                                interactive: false,
                                            }}
                                            positions={linePositions}
                                        />
                                    </React.Fragment>
                                )}
                                <Polyline
                                    pathOptions={{ 
                                        color: PIPELINE_COLOR,
                                        weight: 5,
                                        bubblingMouseEvents: false 
                                    }}
                                    positions={linePositions}
                                    eventHandlers={{
                                        click: (e) => {
                                            handleClickPipeline(value, index);
                                        }
                                    }}
                                    ref={(el) => {
                                        const markerId = `line:${index}`
                                        if (el) {
                                            markerRefs.current[markerId] = el;
                                        }
                                    }}
                                >
                                    <Tooltip>
                                        {value.name}
                                    </Tooltip>
                                </Polyline>
                                {flowArrows.map((arrow) => (
                                    <Marker
                                        key={arrow.key}
                                        position={arrow.position}
                                        {...({
                                            icon: getFlowArrowIcon(arrow.rotation),
                                            interactive: false,
                                            bubblingMouseEvents: false,
                                            keyboard: false,
                                            zIndexOffset: 600,
                                        } as any)}
                                    />
                                ))}
                            </React.Fragment>
                        )
                    })}
                    {isPathSelected && getDraftSegments(
                        selectedNodeData,
                        selectedNodeIdx !== undefined ? lineData[selectedNodeIdx] : undefined
                    ).map((segment, index) => (
                        <Polyline
                            key={`draft-segment:${selectedNodeData?.name || "pipeline"}:${index}`}
                            pathOptions={{
                                color: DRAFT_PIPELINE_COLOR,
                                weight: 6,
                                opacity: 0.95,
                                bubblingMouseEvents: false,
                                interactive: false,
                            }}
                            positions={segment}
                        />
                    ))}
                    </MapContainer>
                }
            </Box>
        </Box>
      );
}

function MapTypeToggle(props) {
    const { updateMapType, style } = props
    const [value, setValue] = useState(0);
    const mapTypes = ['y', 's', 'p', 'h']
    const handleChange = (event, newValue) => {
        setValue(newValue);
        updateMapType(mapTypes[newValue])
    };

    return (
        <Box style={style}>
        <Tabs
            onChange={handleChange}
            value={value}
            aria-label="Tabs where each tab needs to be selected manually"
        >
            <Tab label="Standard" />
            <Tab label="Satellite" />
            <Tab label="Hybrid" />
            <Tab label="Roads" />
        </Tabs>
        </Box>
    );
}
