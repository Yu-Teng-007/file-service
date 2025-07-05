<template>
  <div class="main-layout">
    <el-container>
      <!-- 侧边栏 -->
      <el-aside :width="isCollapse ? '64px' : '200px'" class="sidebar">
        <div class="logo">
          <el-icon v-if="isCollapse" size="24" class="logo-icon"><Folder /></el-icon>
          <transition name="logo-text-fade">
            <span v-if="!isCollapse" class="logo-text">文件管理系统</span>
          </transition>
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
              <el-button :icon="Switch" text size="large" />
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
  Switch,
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

  // 添加微妙的触觉反馈效果
  if (navigator.vibrate) {
    navigator.vibrate(10)
  }
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
  overflow: hidden;
}

.main-layout :deep(.el-aside) {
  height: 100%;
  overflow: hidden;
}

.main-layout :deep(.el-header) {
  height: 60px !important;
  padding: 0;
  flex-shrink: 0;
}

.main-layout :deep(.el-main) {
  height: calc(100% - 60px);
  padding: 0;
  overflow: hidden;
  flex: 1;
  display: flex;
  flex-direction: column;
}

.sidebar {
  background-color: var(--el-bg-color-page);
  border-right: 1px solid var(--el-border-color);
  /* 优化动画效果，使用 cubic-bezier 缓动函数 */
  transition: width 0.28s cubic-bezier(0.4, 0, 0.2, 1);
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  /* 启用硬件加速 */
  will-change: width;
  transform: translateZ(0);
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
  /* 优化logo文字的过渡效果 */
  transition: all 0.28s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  padding: 0 16px;
}

.logo-text {
  margin-left: 8px;
  white-space: nowrap;
  overflow: hidden;
  font-weight: 600;
  letter-spacing: 0.5px;
}

.logo-icon {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  font-size: 24px;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Logo文字淡入淡出动画 */
.logo-text-fade-enter-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  transition-delay: 0.1s; /* 延迟显示，等宽度动画完成 */
}

.logo-text-fade-leave-active {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.logo-text-fade-enter-from {
  opacity: 0;
  transform: translateX(-10px);
}

.logo-text-fade-leave-to {
  opacity: 0;
  transform: translateX(-10px);
}

.sidebar-menu {
  border-right: none;
  flex: 1;
  overflow-y: auto;
  height: 0; /* 强制flex子元素计算高度 */
  /* 优化菜单滚动性能 */
  -webkit-overflow-scrolling: touch;
  scrollbar-width: thin;
}

/* 优化菜单项的动画效果 */
.sidebar-menu :deep(.el-menu-item) {
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  border-radius: 6px;
  margin: 4px 8px;
  height: 48px;
  line-height: 48px;
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
}

/* 优化菜单图标和文字的过渡 */
.sidebar-menu :deep(.el-menu-item .el-icon) {
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  margin-right: 8px;
  flex-shrink: 0;
  font-size: 18px;
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sidebar-menu :deep(.el-menu-item span) {
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  white-space: nowrap;
  overflow: hidden;
  flex: 1;
}

/* 折叠状态下的菜单项优化 */
.sidebar-menu :deep(.el-menu--collapse .el-menu-item) {
  justify-content: center;
  padding: 0 !important;
}

.sidebar-menu :deep(.el-menu--collapse .el-menu-item .el-icon) {
  margin-right: 0;
  margin-left: 0;
}

.sidebar-menu :deep(.el-menu--collapse .el-menu-item span) {
  opacity: 0;
  transform: translateX(-10px);
  width: 0;
  overflow: hidden;
}

.sidebar-menu :deep(.el-menu-item span) {
  opacity: 1;
  transform: translateX(0);
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
  padding: 0;
  overflow: hidden;
  flex: 1;
  width: 100%;
  height: 0; /* 强制flex子元素计算高度 */
}

/* 优化折叠按钮的动画效果 */
.header-left .el-button {
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  border-radius: 8px;
}

.header-left .el-button:hover {
  transform: scale(1.05);
  background-color: var(--el-color-primary-light-9);
}

.header-left .el-button:active {
  transform: scale(0.95);
}

/* 优化折叠按钮图标的旋转动画 */
.header-left .el-button .el-icon {
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* 添加一些微妙的阴影效果 */
.sidebar {
  box-shadow: 2px 0 8px rgba(0, 0, 0, 0.05);
}

/* 优化滚动条样式 */
.sidebar-menu::-webkit-scrollbar {
  width: 4px;
}

.sidebar-menu::-webkit-scrollbar-track {
  background: transparent;
}

.sidebar-menu::-webkit-scrollbar-thumb {
  background: var(--el-border-color-light);
  border-radius: 2px;
  transition: background 0.2s ease;
}

.sidebar-menu::-webkit-scrollbar-thumb:hover {
  background: var(--el-border-color);
}

/* 性能优化：减少重绘和回流 */
.sidebar,
.sidebar-menu,
.logo,
.header-left .el-button {
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
}

/* 为低性能设备优化动画 */
@media (prefers-reduced-motion: reduce) {
  .sidebar,
  .logo,
  .logo-text,
  .sidebar-menu :deep(.el-menu-item),
  .header-left .el-button {
    transition: none !important;
    animation: none !important;
  }

  .logo-text-fade-enter-active,
  .logo-text-fade-leave-active {
    transition: none !important;
  }
}

/* 为高刷新率屏幕优化 */
@media (min-resolution: 120dpi) {
  .sidebar {
    transition-duration: 0.24s;
  }

  .sidebar-menu :deep(.el-menu-item) {
    transition-duration: 0.2s;
  }
}

/* 确保折叠状态下的完美对齐 */
.sidebar-menu :deep(.el-menu--collapse) {
  width: 64px;
}

.sidebar-menu :deep(.el-menu--collapse .el-menu-item) {
  width: 48px;
  margin: 4px 8px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sidebar-menu :deep(.el-menu--collapse .el-tooltip__trigger) {
  width: 100%;
  display: flex;
  justify-content: center;
}

/* 修复Element Plus菜单的默认样式 */
.sidebar-menu :deep(.el-menu-item) {
  padding-left: 16px !important;
  padding-right: 16px !important;
}

.sidebar-menu :deep(.el-menu--collapse .el-menu-item) {
  padding-left: 0 !important;
  padding-right: 0 !important;
}
</style>
