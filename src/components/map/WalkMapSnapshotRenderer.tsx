import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { WalkMapRendererProps } from '../../types/walk';

/**
 * Placeholder for Phase 4 R&D: Static Snapshot Minimap Overlay.
 * 
 * Later, this will use Mapbox.snapshotManager to extract a static background image,
 * and geoProjection.ts to render the avatar over the image via standard RN Views
 * to avoid Native Mapbox re-rendering overhead.
 */
export function WalkMapSnapshotRenderer({ course, progress, isGameMode }: WalkMapRendererProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>[Phase 4 R&D] Snapshot Renderer Not Implemented</Text>
      <Text style={styles.subtext}>Progress: {(progress * 100).toFixed(0)}%</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1e1e1e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: '#00e599',
    fontWeight: 'bold',
    fontSize: 16,
  },
  subtext: {
    color: '#888',
    marginTop: 8,
  }
});
