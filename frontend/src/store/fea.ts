import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';
import type { FEAModel, FEAResult, FEASnapshot } from '../types';
import {
  solve as feaSolve,
  presetCantileverBeam,
  presetBridgeTruss,
  presetSimpleFrame,
  jetColormap,
} from '../utils/fea-solver';

const SNAPSHOT_STORAGE_KEY = 'fea_snapshots_v1';

function loadSnapshotsFromStorage(): FEASnapshot[] {
  try {
    const raw = localStorage.getItem(SNAPSHOT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as FEASnapshot[];
    return [];
  } catch (e) {
    console.warn('[FEA Store] Failed to load snapshots from localStorage:', e);
    return [];
  }
}

function persistSnapshots(snapshots: FEASnapshot[]) {
  try {
    localStorage.setItem(SNAPSHOT_STORAGE_KEY, JSON.stringify(snapshots));
  } catch (e) {
    console.warn('[FEA Store] Failed to persist snapshots to localStorage:', e);
  }
}

export const useFEAStore = defineStore('fea', () => {
  const model = ref<FEAModel>({ nodes: [], elements: [], loads: [] });
  const result = ref<FEAResult | null>(null);
  const selectedPreset = ref<string>('cantilever');
  const showDeformed = ref(false);
  const deformationScale = ref(10);
  const selectedElement = ref<number | null>(null);
  const heatmapMode = ref<'stress' | 'strain' | 'force'>('stress');
  const snapshots = ref<FEASnapshot[]>(loadSnapshotsFromStorage());

  watch(
    snapshots,
    (val) => persistSnapshots(val),
    { deep: true }
  );

  // ─── Actions ──────────────────────────────────────────────────────────────
  function loadPreset(name: string) {
    selectedPreset.value = name;
    result.value = null;
    selectedElement.value = null;
    switch (name) {
      case 'cantilever':
        model.value = presetCantileverBeam();
        break;
      case 'bridge':
        model.value = presetBridgeTruss();
        break;
      case 'frame':
        model.value = presetSimpleFrame();
        break;
      default:
        model.value = presetCantileverBeam();
    }
  }

  function solve() {
    result.value = feaSolve(model.value);
    if (result.value) {
      saveSnapshot();
    }
  }

  function saveSnapshot() {
    if (!result.value) return;
    const now = Date.now();
    const id = `snap_${now}_${Math.random().toString(36).slice(2, 8)}`;
    const presetNames: Record<string, string> = {
      cantilever: '悬臂梁',
      bridge: '桥梁桁架',
      frame: '简单框架',
    };
    const timeStr = new Date(now).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    const snapshot: FEASnapshot = {
      id,
      name: `${presetNames[selectedPreset.value] || selectedPreset.value} - ${timeStr}`,
      createdAt: now,
      presetName: selectedPreset.value,
      heatmapMode: heatmapMode.value,
      selectedElement: selectedElement.value,
      showDeformed: showDeformed.value,
      deformationScale: deformationScale.value,
      model: JSON.parse(JSON.stringify(model.value)),
      result: JSON.parse(JSON.stringify(result.value)),
    };
    snapshots.value.unshift(snapshot);
  }

  function loadSnapshot(id: string) {
    const snap = snapshots.value.find((s) => s.id === id);
    if (!snap) return;
    model.value = JSON.parse(JSON.stringify(snap.model));
    result.value = JSON.parse(JSON.stringify(snap.result));
    selectedPreset.value = snap.presetName;
    heatmapMode.value = snap.heatmapMode;
    selectedElement.value = snap.selectedElement;
    showDeformed.value = snap.showDeformed;
    deformationScale.value = snap.deformationScale;
  }

  function deleteSnapshot(id: string) {
    const idx = snapshots.value.findIndex((s) => s.id === id);
    if (idx >= 0) snapshots.value.splice(idx, 1);
  }

  function clearSnapshots() {
    snapshots.value = [];
  }

  function renameSnapshot(id: string, name: string) {
    const snap = snapshots.value.find((s) => s.id === id);
    if (snap) snap.name = name;
  }

  function toggleDeformed() {
    showDeformed.value = !showDeformed.value;
  }

  function selectElement(id: number | null) {
    selectedElement.value = id;
  }

  function setHeatmapMode(mode: 'stress' | 'strain' | 'force') {
    heatmapMode.value = mode;
  }

  function addLoad(nodeId: number, fx: number, fy: number) {
    model.value.loads.push({ nodeId, fx, fy });
  }

  function toggleFixed(nodeId: number) {
    const node = model.value.nodes.find((n) => n.id === nodeId);
    if (node) node.fixed = !node.fixed;
  }

  // ─── Computed ─────────────────────────────────────────────────────────────
  const maxStress = computed(() => {
    if (!result.value) return 0;
    return result.value.maxStress;
  });

  const maxDisplacement = computed(() => {
    if (!result.value) return 0;
    return result.value.maxDisplacement;
  });

  const elementColors = computed(() => {
    const colors = new Map<number, string>();
    if (!result.value || model.value.elements.length === 0) {
      for (const el of model.value.elements) {
        colors.set(el.id, '#6b7280');
      }
      return colors;
    }

    let values: number[];
    switch (heatmapMode.value) {
      case 'stress':
        values = result.value.stresses.map(Math.abs);
        break;
      case 'strain':
        values = result.value.strains.map(Math.abs);
        break;
      case 'force':
        values = model.value.elements.map((e) => Math.abs(e.force));
        break;
      default:
        values = result.value.stresses.map(Math.abs);
    }

    const min = Math.min(...values);
    const max = Math.max(...values);

    for (let i = 0; i < model.value.elements.length; i++) {
      colors.set(
        model.value.elements[i].id,
        jetColormap(values[i], min, max)
      );
    }
    return colors;
  });

  return {
    model,
    result,
    selectedPreset,
    showDeformed,
    deformationScale,
    selectedElement,
    heatmapMode,
    snapshots,
    maxStress,
    maxDisplacement,
    elementColors,
    loadPreset,
    solve,
    toggleDeformed,
    selectElement,
    setHeatmapMode,
    addLoad,
    toggleFixed,
    saveSnapshot,
    loadSnapshot,
    deleteSnapshot,
    clearSnapshots,
    renameSnapshot,
  };
});
