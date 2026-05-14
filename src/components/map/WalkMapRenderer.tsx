import React from 'react';
import { View, StyleSheet } from 'react-native';
import Mapbox from '@rnmapbox/maps';
import { WalkMapRendererProps } from '../../types/walk';
import { getCoordinateAlongRoute } from '../../utils/geoProjection';
import { RouteLayer } from './RouteLayer';
import mockRoute from '../../data/mockRoute.json';

export function WalkMapRenderer({ course, progress, isGameMode }: WalkMapRendererProps) {
  // Calculate the current avatar location based on the route progress
  const currentCoord = getCoordinateAlongRoute(progress);

  // Create a GeoJSON Feature for the avatar
  const avatarFeature = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        id: 'avatar-feature',
        geometry: {
          type: 'Point',
          coordinates: currentCoord,
        },
        properties: {},
      },
    ],
  };

  return (
    <View style={{ flex: 1 }}>
      <Mapbox.MapView 
        style={{ flex: 1 }} 
        styleURL={'mapbox://styles/mapbox/dark-v11'}
        logoEnabled={false}
        attributionEnabled={false}
      >
        <Mapbox.Camera
          zoomLevel={isGameMode ? 17 : 14}
          pitch={isGameMode ? 60 : 0}
          centerCoordinate={currentCoord}
          animationMode="flyTo"
          animationDuration={800}
        />
        
        {/* Draw the full mock route */}
        <RouteLayer data={mockRoute} />
        
        {/* Guaranteed crash-free avatar using OpenGL layers */}
        <Mapbox.ShapeSource id="avatar-source" shape={avatarFeature as any}>
          <Mapbox.CircleLayer
            id="avatar-circle-outline"
            style={{
              circleRadius: 12,
              circleColor: course.color,
              circleStrokeWidth: 3,
              circleStrokeColor: '#ffffff',
            }}
          />
        </Mapbox.ShapeSource>
      </Mapbox.MapView>
      
      {/* If game mode is enabled, we can overlay decorative elements like a skyline here */}
      {isGameMode && (
        <View pointerEvents="none" style={styles.gameOverlay}>
          <View style={styles.skylineGradient} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  gameOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-start',
  },
  skylineGradient: {
    height: 120,
    backgroundColor: 'rgba(0,0,0,0.3)', // Simulated dark sky fade
  }
});
