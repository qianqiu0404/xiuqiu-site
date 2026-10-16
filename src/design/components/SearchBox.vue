<script setup lang="ts">
defineProps<{ label: string; placeholder?: string }>()
const model = defineModel<string>({ required: true })
</script>

<template>
  <label class="brief-search">
    <span class="brief-sr-only">{{ label }}</span>
    <input v-model="model" type="search" :placeholder="placeholder ?? label" autocomplete="off" />
  </label>
</template>
