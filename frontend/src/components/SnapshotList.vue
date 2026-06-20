<script setup lang="ts">
import { ref } from 'vue';
import { useFEAStore } from '../store/fea';

const store = useFEAStore();
const editingId = ref<string | null>(null);
const editingName = ref('');

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatStress(pa: number): string {
  return (pa / 1e6).toFixed(2) + ' MPa';
}

function formatDisplacement(m: number): string {
  return (m * 1000).toFixed(3) + ' mm';
}

function startRename(id: string, name: string) {
  editingId.value = id;
  editingName.value = name;
}

function commitRename() {
  if (editingId.value && editingName.value.trim()) {
    store.renameSnapshot(editingId.value, editingName.value.trim());
  }
  editingId.value = null;
  editingName.value = '';
}

function cancelRename() {
  editingId.value = null;
  editingName.value = '';
}

const heatmapModeLabels: Record<string, string> = {
  stress: '应力',
  strain: '应变',
  force: '轴力',
};
</script>

<template>
  <div class="bg-slate-800 rounded-lg p-4 space-y-3">
    <div class="flex items-center justify-between border-b border-slate-700 pb-2">
      <h3 class="text-sm font-bold text-slate-200">
        📸 分析快照
        <span class="text-xs text-slate-500 font-normal ml-1">
          ({{ store.snapshots.length }})
        </span>
      </h3>
      <div class="flex gap-1">
        <button
          @click="store.saveSnapshot()"
          :disabled="!store.result"
          class="px-2 py-1 rounded text-[10px] font-medium bg-sky-700 text-white hover:bg-sky-600 transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          保存当前
        </button>
        <button
          v-if="store.snapshots.length > 0"
          @click="store.clearSnapshots()"
          class="px-2 py-1 rounded text-[10px] font-medium bg-rose-800 text-white hover:bg-rose-700 transition"
        >
          清空
        </button>
      </div>
    </div>

    <div v-if="store.snapshots.length === 0" class="text-xs text-slate-500 text-center py-6">
      暂无快照<br />
      <span class="text-[10px]">求解 FEA 后将自动保存</span>
    </div>

    <div v-else class="space-y-2 max-h-[400px] overflow-y-auto pr-1">
      <div
        v-for="snap in store.snapshots"
        :key="snap.id"
        class="bg-slate-900 rounded p-2.5 border border-slate-700 hover:border-slate-600 transition group"
      >
        <div class="flex items-start justify-between gap-2 mb-1.5">
          <div class="flex-1 min-w-0">
            <input
              v-if="editingId === snap.id"
              v-model="editingName"
              @keyup.enter="commitRename()"
              @keyup.esc="cancelRename()"
              @blur="commitRename()"
              class="w-full bg-slate-800 border border-sky-600 rounded px-1.5 py-0.5 text-xs text-slate-100 outline-none"
              autofocus
            />
            <div
              v-else
              class="text-xs font-medium text-slate-200 truncate cursor-pointer hover:text-sky-400 transition"
              @click="store.loadSnapshot(snap.id)"
              @dblclick="startRename(snap.id, snap.name)"
            >
              {{ snap.name }}
            </div>
            <div class="text-[10px] text-slate-500 mt-0.5">
              {{ formatTime(snap.createdAt) }}
            </div>
          </div>
          <div class="flex gap-0.5 opacity-0 group-hover:opacity-100 transition">
            <button
              @click="store.loadSnapshot(snap.id)"
              class="px-1.5 py-0.5 rounded text-[10px] bg-sky-700 text-white hover:bg-sky-600 transition"
              title="加载此快照"
            >
              加载
            </button>
            <button
              @click="store.deleteSnapshot(snap.id)"
              class="px-1.5 py-0.5 rounded text-[10px] bg-rose-800 text-white hover:bg-rose-700 transition"
              title="删除此快照"
            >
              删
            </button>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-1 text-[10px]">
          <div class="bg-slate-800 rounded px-1.5 py-1">
            <span class="text-slate-500">最大应力 </span>
            <span class="text-red-400 font-mono font-bold">
              {{ formatStress(snap.result.maxStress) }}
            </span>
          </div>
          <div class="bg-slate-800 rounded px-1.5 py-1">
            <span class="text-slate-500">最大位移 </span>
            <span class="text-amber-400 font-mono font-bold">
              {{ formatDisplacement(snap.result.maxDisplacement) }}
            </span>
          </div>
          <div class="bg-slate-800 rounded px-1.5 py-1">
            <span class="text-slate-500">热力图 </span>
            <span class="text-purple-400 font-medium">
              {{ heatmapModeLabels[snap.heatmapMode] }}
            </span>
          </div>
          <div class="bg-slate-800 rounded px-1.5 py-1">
            <span class="text-slate-500">选中单元 </span>
            <span class="text-slate-300 font-mono">
              {{ snap.selectedElement !== null ? '#' + snap.selectedElement : '无' }}
            </span>
          </div>
        </div>

        <div v-if="snap.showDeformed" class="mt-1.5">
          <span class="inline-block px-1.5 py-0.5 rounded bg-amber-900/50 text-amber-400 text-[9px] font-medium">
            变形 x{{ snap.deformationScale }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
