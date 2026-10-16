<script setup lang="ts">
// Toggle group with counts. `variant="tabs"` renders the segmented control.
defineProps<{
  label: string
  options: { key: string; label: string; count?: number }[]
  active?: string
  variant?: 'chips' | 'tabs'
}>()
defineEmits<{ select: [key: string] }>()
</script>

<template>
  <div :class="variant === 'tabs' ? 'brief-tabs' : 'brief-chips'" role="group" :aria-label="label">
    <button
      v-for="option in options"
      :key="option.key"
      type="button"
      :class="{ active: active === option.key }"
      :aria-pressed="active === option.key"
      @click="$emit('select', option.key)"
    >
      {{ option.label }} <span v-if="option.count !== undefined">{{ option.count }}</span>
    </button>
  </div>
</template>
