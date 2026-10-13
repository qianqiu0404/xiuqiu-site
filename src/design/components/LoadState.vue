<script setup lang="ts">
// Loading / error / empty states with the right live-region roles.
defineProps<{
  state: 'loading' | 'error' | 'empty'
  message: string
  actionLabel?: string
  hint?: string
}>()
defineEmits<{ action: [] }>()
</script>

<template>
  <div
    class="radar-archive-empty"
    :role="state === 'error' ? 'alert' : 'status'"
    :aria-busy="state === 'loading' || undefined"
  >
    <p>{{ message }}</p>
    <button v-if="actionLabel" type="button" @click="$emit('action')">{{ actionLabel }}</button>
    <p v-else-if="hint">{{ hint }}</p>
  </div>
</template>
