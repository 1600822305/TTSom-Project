import { isMac } from '@renderer/config/constant'
import { isLocalAi } from '@renderer/config/env'
import { useTheme } from '@renderer/context/ThemeProvider'
import db from '@renderer/databases'
import i18n from '@renderer/i18n'
import ASRServerService from '@renderer/services/ASRServerService'
import { useAppDispatch } from '@renderer/store'
import { setAvatar, setFilesPath, setResourcesPath, setUpdateState } from '@renderer/store/runtime'
import { delay, runAsyncFunction } from '@renderer/utils'
import { disableAnalytics, initAnalytics } from '@renderer/utils/analytics'
import { defaultLanguage } from '@shared/config/constant'
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect } from 'react'

import { useDefaultModel } from './useAssistant'
import useFullScreenNotice from './useFullScreenNotice'
import { useRuntime } from './useRuntime'
import { useSettings } from './useSettings'
import useUpdateHandler from './useUpdateHandler'

export function useAppInit() {
  const dispatch = useAppDispatch()
  const {
    proxyUrl,
    language,
    windowStyle,
    autoCheckUpdate,
    proxyMode,
    customCss,
    enableDataCollection,
    asrEnabled,
    asrServiceType,
    asrAutoStartServer
  } = useSettings()
  const { minappShow } = useRuntime()
  const { setDefaultModel, setTopicNamingModel, setTranslateModel } = useDefaultModel()
  const avatar = useLiveQuery(() => db.settings.get('image://avatar'))
  const { theme } = useTheme()

  useUpdateHandler()
  useFullScreenNotice()

  useEffect(() => {
    avatar?.value && dispatch(setAvatar(avatar.value))
  }, [avatar, dispatch])

  useEffect(() => {
    document.getElementById('spinner')?.remove()
    runAsyncFunction(async () => {
      const { isPackaged } = await window.api.getAppInfo()
      if (isPackaged && autoCheckUpdate) {
        await delay(2)
        const { updateInfo } = await window.api.checkForUpdate()
        dispatch(setUpdateState({ info: updateInfo }))
      }
    })
  }, [dispatch, autoCheckUpdate])

  useEffect(() => {
    if (proxyMode === 'system') {
      window.api.setProxy('system')
    } else if (proxyMode === 'custom') {
      proxyUrl && window.api.setProxy(proxyUrl)
    } else {
      window.api.setProxy('')
    }
  }, [proxyUrl, proxyMode])

  useEffect(() => {
    i18n.changeLanguage(language || navigator.language || defaultLanguage)
  }, [language])

  useEffect(() => {
    const transparentWindow = windowStyle === 'transparent' && isMac && !minappShow

    if (minappShow) {
      window.root.style.background = theme === 'dark' ? 'var(--color-black)' : 'var(--color-white)'
      return
    }

    window.root.style.background = transparentWindow ? 'var(--navbar-background-mac)' : 'var(--navbar-background)'
  }, [windowStyle, minappShow, theme])

  useEffect(() => {
    if (isLocalAi) {
      const model = JSON.parse(import.meta.env.VITE_RENDERER_INTEGRATED_MODEL)
      setDefaultModel(model)
      setTopicNamingModel(model)
      setTranslateModel(model)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    // set files path
    window.api.getAppInfo().then((info: { filesPath: string; resourcesPath: string }) => {
      dispatch(setFilesPath(info.filesPath))
      dispatch(setResourcesPath(info.resourcesPath))
    })
  }, [dispatch])

  useEffect(() => {
    import('@renderer/queue/KnowledgeQueue')
  }, [])

  useEffect(() => {
    const oldCustomCss = document.getElementById('user-defined-custom-css')
    if (oldCustomCss) {
      oldCustomCss.remove()
    }

    if (customCss) {
      const style = document.createElement('style')
      style.id = 'user-defined-custom-css'
      style.textContent = customCss
      document.head.appendChild(style)
    }
  }, [customCss])

  useEffect(() => {
    if (enableDataCollection) {
      initAnalytics()
      // TODO: init data collection
    } else {
      disableAnalytics()
    }
  }, [enableDataCollection])

  // 自动启动ASR服务器
  useEffect(() => {
    if (asrEnabled && asrServiceType === 'local' && asrAutoStartServer) {
      console.log('自动启动ASR服务器...')
      ASRServerService.startServer().then((success) => {
        if (success) {
          console.log('ASR服务器自动启动成功')
        } else {
          console.error('ASR服务器自动启动失败')
        }
      })
    }
  }, [asrEnabled, asrServiceType, asrAutoStartServer])
}
