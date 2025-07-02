<template>
  <div class="main-layout">
    <el-container>
      <!-- 侧边栏 -->
      <el-aside :width="isCollapse ? '64px' : '200px'" class="sidebar">
        <div class="logo">
          <el-icon v-if="isCollapse" size="24"><Folder /></el-icon>
          <span v-else class="logo-text">文件管理系统</span>
        </div>

        <el-menu
          :default-active="$route.path"
          :collapse="isCollapse"
          :unique-opened="true"
          router
          class="sidebar-menu"
        >
          <el-menu-item index="/dashboard">
            <el-icon><Dashboard /></el-icon>
            <template #title>{{ $t('nav.dashboard') }}</template>
          </el-menu-item>

          <el-menu-item index="/files">
            <el-icon><Folder /></el-icon>
            <template #title>{{ $t('nav.fileList') }}</template>
          </el-menu-item>

          <el-menu-item index="/upload">
            <el-icon><Upload /></el-icon>
            <template #title>{{ $t('nav.upload') }}</template>
          </el-menu-item>

          <el-menu-item index="/settings">
            <el-icon><Setting /></el-icon>
            <template #title>{{ $t('nav.settings') }}</template>
          </el-menu-item>
        </el-menu>
      </el-aside>

      <!-- 主内容区 -->
      <el-container>
        <!-- 顶部导航 -->
        <el-header class="header">
          <div class="header-left">
            <el-button
              :icon="isCollapse ? Expand : Fold"
              @click="toggleCollapse"
              text
              size="large"
            />

            <el-breadcrumb separator="/">
              <el-breadcrumb-item :to="{ path: '/' }">首页</el-breadcrumb-item>
              <el-breadcrumb-item v-if="$route.meta?.title">
                {{ $route.meta.title }}
              </el-breadcrumb-item>
            </el-breadcrumb>
          </div>

          <div class="header-right">
            <!-- 主题切换 -->
            <el-dropdown @command="handleThemeChange">
              <el-button :icon="themeIcon" text size="large" />
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="light">
                    <el-icon><Sunny /></el-icon>
                    {{ $t('settings.themes.light') }}
                  </el-dropdown-item>
                  <el-dropdown-item command="dark">
                    <el-icon><Moon /></el-icon>
                    {{ $t('settings.themes.dark') }}
                  </el-dropdown-item>
                  <el-dropdown-item command="auto">
                    <el-icon><Monitor /></el-icon>
                    {{ $t('settings.themes.auto') }}
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>

            <!-- 语言切换 -->
            <el-dropdown @command="handleLanguageChange">
              <el-button icon="Globe" text size="large" />
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="zh-CN">中文</el-dropdown-item>
                  <el-dropdown-item command="en-US">English</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>

            <!-- 刷新 -->
            <el-button :icon="Refresh" @click="handleRefresh" text size="large" />
          </div>
        </el-header>

        <!-- 主内容 -->
        <el-main class="main-content">
          <router-view />
        </el-main>
      </el-container>
    </el-container>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useConfigStore } from '@/stores/config'
import {
  Odometer as Dashboard,
  Folder,
  Upload,
  Setting,
  Expand,
  Fold,
  Refresh,
  Sunny,
  Moon,
  Monitor,
} from '@element-plus/icons-vue'

const router = useRouter()
const { locale } = useI18n()
const configStore = useConfigStore()

// 侧边栏折叠状态
const isCollapse = ref(false)

// 主题图标
const themeIcon = computed(() => {
  switch (configStore.theme) {
    case 'light':
      return Sunny
    case 'dark':
      return Moon
    default:
      return Monitor
  }
})

// 方法
const toggleCollapse = () => {
  isCollapse.value = !isCollapse.value
}

const handleThemeChange = (theme: string) => {
  configStore.updateTheme(theme as any)
}

const handleLanguageChange = (lang: string) => {
  locale.value = lang
  configStore.updateLanguage(lang as any)
}

const handleRefresh = () => {
  router.go(0)
}

// 初始化配置
configStore.init()
</script>

<style scoped>
.main-layout {
  width: 100vw;
  height: 100vh;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  overflow: hidden;
}

.main-layout :deep(.el-container) {
  height: 100%;
  width: 100%;
}

.main-layout :deep(.el-aside) {
  height: 100vh;
}

.main-layout :deep(.el-header) {
  height: 60px !important;
  padding: 0;
}

.main-layout :deep(.el-main) {
  height: calc(100vh - 60px);
  padding: 0;
  overflow: hidden;
}

.sidebar {
  background-color: var(--el-bg-color-page);
  border-right: 1px solid var(--el-border-color);
  transition: width 0.3s;
  height: 100vh;
  overflow-y: auto;
}

.logo {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-bottom: 1px solid var(--el-border-color);
  font-size: 18px;
  font-weight: bold;
  color: var(--el-color-primary);
  flex-shrink: 0;
}

.logo-text {
  margin-left: 8px;
}

.sidebar-menu {
  border-right: none;
  height: calc(100vh - 60px);
  overflow-y: auto;
}

.header {
  background-color: var(--el-bg-color);
  border-bottom: 1px solid var(--el-border-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  height: 60px;
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.main-content {
  background-color: var(--el-bg-color-page);
  padding: 20px;
  overflow-y: auto;
  height: calc(100vh - 60px);
  width: 100%;
}
</style>
