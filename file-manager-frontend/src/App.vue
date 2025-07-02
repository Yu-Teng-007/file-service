<template>
  <div id="app" :class="{ dark: isDark }">
    <el-config-provider :locale="locale">
      <router-view />
    </el-config-provider>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useConfigStore } from '@/stores/config'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import en from 'element-plus/es/locale/lang/en'

const configStore = useConfigStore()

const isDark = computed(() => {
  if (configStore.theme === 'auto') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  }
  return configStore.theme === 'dark'
})

const locale = computed(() => {
  return configStore.language === 'zh-CN' ? zhCn : en
})

// 监听系统主题变化
if (configStore.theme === 'auto') {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  mediaQuery.addEventListener('change', () => {
    document.documentElement.classList.toggle('dark', mediaQuery.matches)
  })
}

// 设置初始主题
document.documentElement.classList.toggle('dark', isDark.value)
</script>

<style>
/* 全局重置样式，确保页面占满整个屏幕 */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

#app {
  font-family:
    'Helvetica Neue', Helvetica, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', '微软雅黑',
    Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
}

html.dark {
  color-scheme: dark;
}
</style>
