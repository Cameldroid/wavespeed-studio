// WaveSpeed Studio Client Application
(function () {
  'use strict';

  // App State
  const savedThreshold = parseFloat(localStorage.getItem('wavespeed_spend_guard_threshold') ?? '0.50');
  const state = {
    models: [],
    filteredModels: [],
    selectedModel: null,
    currentCategory: 'image-gen',
    comboboxFilter: 'tab', // 'tab' (default), 'spicy', 'affordable', 'all', 'cheap'
    comboboxActiveIndex: -1,
    comboboxUserTyped: false,
    balance: 0,
    accountDiscount: parseInt(localStorage.getItem('wavespeed_extra_discount') || '0', 10),
    spendGuardEnabled: localStorage.getItem('wavespeed_spend_guard_enabled') !== 'false',
    spendGuardThreshold: (!isNaN(savedThreshold) && savedThreshold >= 0) ? savedThreshold : 0.50,
    economyDefaultsEnabled: localStorage.getItem('wavespeed_economy_defaults') !== 'false',
    currentTaskId: null,
    pollTimer: null,
    elapsedTimer: null,
    startTime: null,
    activeJobs: new Map(),
    jobCounter: 0,
    activeJobsTickTimer: null,
    sourceImage: null, // { file, base64, url, downloadUrl }
    sourceImageDimensions: null, // { width, height }
    lastImage: null, // { file, url, downloadUrl }
    extraImages: [], // [{ id, file, previewUrl, downloadUrl }]
    refVideos: [], // [{ id, file, url, previewUrl, downloadUrl, name, width, height, duration }]
    refAudios: [], // [{ id, file, url, downloadUrl, name, duration }]
    sourceVideo: null, // { file, url, downloadUrl }
    sourceVideoDimensions: null, // { width, height }
    sourceVideoDuration: null,
    timelineVideo: null, // { src, objectUrl, name, width, height, duration }
    timelineIsObjectUrl: false,
    timelineSource: null,
    timelineScanToken: 0,
    trimStartSec: 0,
    trimEndSec: 15,
    historyModelStats: new Map(),
    maskDataUrl: null,
    isDrawing: false,
    hasDrawnMask: false,
    activeLocalPath: null,
    activeLocalUrl: null,
    activeRemoteUrl: null,
    activeOutputItem: null,
    outputsDir: './outputs',
    history: [],
    galleryFilter: 'all', // 'all' | 'images' | 'videos'
    gallerySize: localStorage.getItem('wavespeed_gallery_size') || 'md',
    compareKeys: [],
    bulkSelectMode: false,
    bulkSelectedKeys: [],
    beforeAfterActive: false,
    beforeAfterWipePct: 50,
    recommendedUncensoredModelId: null,
    designTheme: localStorage.getItem('wavespeed_studio_theme') || 'obsidian-pro',
    designDensity: localStorage.getItem('wavespeed_studio_density') || 'compact',
    viewerStage: localStorage.getItem('wavespeed_viewer_stage') || 'tall',
    customPromptChips: []
  };

  // DOM Elements
  const el = {
    balanceValue: document.getElementById('balanceValue'),
    sidebarBalanceProjection: document.getElementById('sidebarBalanceProjection'),
    refreshBalanceBtn: document.getElementById('refreshBalanceBtn'),
    syncPricesBtn: document.getElementById('syncPricesBtn'),
    syncPricesLabel: document.getElementById('syncPricesLabel'),
    openOutputsFolderBtn: document.getElementById('openOutputsFolderBtn'),
    openOutputsHistoryBtn: document.getElementById('openOutputsHistoryBtn'),
    showInFolderBtn: document.getElementById('showInFolderBtn'),
    localSaveBanner: document.getElementById('localSaveBanner'),
    outputsPathLabel: document.getElementById('outputsPathLabel'),
    modeBtns: document.querySelectorAll('.mode-btn'),
    modelsCountBadge: document.getElementById('modelsCountBadge'),
    modelCombobox: document.getElementById('modelCombobox'),
    modelAutocompleteInput: document.getElementById('modelAutocompleteInput'),
    comboboxClearBtn: document.getElementById('comboboxClearBtn'),
    comboboxToggleBtn: document.getElementById('comboboxToggleBtn'),
    comboboxDropdown: document.getElementById('comboboxDropdown'),
    comboboxList: document.getElementById('comboboxList'),
    chipFilterBtns: document.querySelectorAll('.chip-filter-btn'),
    modelSelect: document.getElementById('modelSelect'),
    selectedModelInfo: document.getElementById('selectedModelInfo'),
    infoModelTitle: document.getElementById('infoModelTitle'),
    infoModelPrice: document.getElementById('infoModelPrice'),
    infoPriceBreakdown: document.getElementById('infoPriceBreakdown'),
    infoModelDesc: document.getElementById('infoModelDesc'),
    infoModelTags: document.getElementById('infoModelTags'),
    promptGroup: document.getElementById('promptGroup'),
    promptInput: document.getElementById('promptInput'),
    imageInputGroup: document.getElementById('imageInputGroup'),
    imageDropzone: document.getElementById('imageDropzone'),
    imageFileInput: document.getElementById('imageFileInput'),
    imagePreviewContainer: document.getElementById('imagePreviewContainer'),
    imagePreview: document.getElementById('imagePreview'),
    removeImageBtn: document.getElementById('removeImageBtn'),
    imageUrlInput: document.getElementById('imageUrlInput'),
    loadUrlBtn: document.getElementById('loadUrlBtn'),
    maskCanvasGroup: document.getElementById('maskCanvasGroup'),
    maskCanvas: document.getElementById('maskCanvas'),
    brushSize: document.getElementById('brushSize'),
    clearMaskBtn: document.getElementById('clearMaskBtn'),
    videoInputGroup: document.getElementById('videoInputGroup'),
    videoFileInput: document.getElementById('videoFileInput'),
    videoDropzone: document.getElementById('videoDropzone'),
    videoUrlInput: document.getElementById('videoUrlInput'),
    multiImageGroup: document.getElementById('multiImageGroup'),
    ratioPills: document.getElementById('ratioPills'),
    aspectRatioRow: document.getElementById('aspectRatioRow'),
    resolutionCol: document.getElementById('resolutionCol'),
    resolutionSelect: document.getElementById('resolutionSelect'),
    durationRow: document.getElementById('durationRow'),
    durationSelect: document.getElementById('durationSelect'),
    sizeRow: document.getElementById('sizeRow'),
    sizeSelect: document.getElementById('sizeSelect'),
    qualityRow: document.getElementById('qualityRow'),
    qualitySelect: document.getElementById('qualitySelect'),
    numImagesRow: document.getElementById('numImagesRow'),
    numImagesSelect: document.getElementById('numImagesSelect'),
    audioRow: document.getElementById('audioRow'),
    audioToggleLabel: document.getElementById('audioToggleLabel'),
    audioCheckbox: document.getElementById('audioCheckbox'),
    audioLabelText: document.getElementById('audioLabelText'),
    audioCostHint: document.getElementById('audioCostHint'),
    outputFormatSelect: document.getElementById('outputFormatSelect'),
    strengthRow: document.getElementById('strengthRow'),
    strengthSlider: document.getElementById('strengthSlider'),
    strengthValueLabel: document.getElementById('strengthValueLabel'),
    seedInput: document.getElementById('seedInput'),
    randomizeSeedBtn: document.getElementById('randomizeSeedBtn'),
    affordabilityBanner: document.getElementById('affordabilityBanner'),
    generateBtn: document.getElementById('generateBtn'),
    btnLabel: document.getElementById('btnLabel'),
    btnPriceBadge: document.getElementById('btnPriceBadge'),
    executionCard: document.getElementById('executionCard'),
    execPulseDot: document.getElementById('execPulseDot'),
    execStatusTitle: document.getElementById('execStatusTitle'),
    activeJobsCountBadge: document.getElementById('activeJobsCountBadge'),
    activeJobsList: document.getElementById('activeJobsList'),
    execTimer: document.getElementById('execTimer'),
    execDetails: document.getElementById('execDetails'),
    execProgressBar: document.getElementById('execProgressBar'),
    cancelTaskBtn: document.getElementById('cancelTaskBtn'),
    viewerPlaceholder: document.getElementById('viewerPlaceholder'),
    mediaContainer: document.getElementById('mediaContainer'),
    outputImageViewer: document.getElementById('outputImageViewer'),
    outputVideoViewer: document.getElementById('outputVideoViewer'),
    viewerCostBadge: document.getElementById('viewerCostBadge'),
    fullscreenVideoBtn: document.getElementById('fullscreenVideoBtn'),
    viewerActions: document.getElementById('viewerActions'),
    sendToVideoBtn: document.getElementById('sendToVideoBtn'),
    sendToEditBtn: document.getElementById('sendToEditBtn'),
    downloadOutputBtn: document.getElementById('downloadOutputBtn'),
    copyUrlBtn: document.getElementById('copyUrlBtn'),
    historyGallery: document.getElementById('historyGallery'),
    clearHistoryBtn: document.getElementById('clearHistoryBtn'),
    apiKeyModalBtn: document.getElementById('apiKeyModalBtn'),
    apiKeyModal: document.getElementById('apiKeyModal'),
    closeModalBtn: document.getElementById('closeModalBtn'),
    cancelModalBtn: document.getElementById('cancelModalBtn'),
    saveApiKeyBtn: document.getElementById('saveApiKeyBtn'),
    apiKeyInput: document.getElementById('apiKeyInput'),
    outputsDirInput: document.getElementById('outputsDirInput'),
    browseOutputsDirBtn: document.getElementById('browseOutputsDirBtn'),
    spendGuardEnabledInput: document.getElementById('spendGuardEnabledInput'),
    spendGuardThresholdInput: document.getElementById('spendGuardThresholdInput'),
    spendConfirmModal: document.getElementById('spendConfirmModal'),
    spendConfirmHeadline: document.getElementById('spendConfirmHeadline'),
    spendConfirmDetails: document.getElementById('spendConfirmDetails'),
    spendConfirmWarning: document.getElementById('spendConfirmWarning'),
    closeSpendModalBtn: document.getElementById('closeSpendModalBtn'),
    cancelSpendBtn: document.getElementById('cancelSpendBtn'),
    confirmSpendBtn: document.getElementById('confirmSpendBtn'),
    outputsModal: document.getElementById('outputsModal'),
    closeOutputsModalBtn: document.getElementById('closeOutputsModalBtn'),
    outputsFolderPathCode: document.getElementById('outputsFolderPathCode'),
    copyOutputsPathBtn: document.getElementById('copyOutputsPathBtn'),
    retryExplorerBtn: document.getElementById('retryExplorerBtn'),
    outputsModalStatus: document.getElementById('outputsModalStatus'),
    outputsSummaryText: document.getElementById('outputsSummaryText'),
    outputsFileList: document.getElementById('outputsFileList'),
    economyDefaultsCheckbox: document.getElementById('economyDefaultsCheckbox'),
    economyModeHint: document.getElementById('economyModeHint'),
    openHistoryDbBtn: document.getElementById('openHistoryDbBtn'),
    openHistoryDbSectionBtn: document.getElementById('openHistoryDbSectionBtn'),
    historyDbModal: document.getElementById('historyDbModal'),
    closeHistoryDbModalBtn: document.getElementById('closeHistoryDbModalBtn'),
    historyDbStatsBar: document.getElementById('historyDbStatsBar'),
    historySearchInput: document.getElementById('historySearchInput'),
    historyModelFilterSelect: document.getElementById('historyModelFilterSelect'),
    historyStatusFilterSelect: document.getElementById('historyStatusFilterSelect'),
    historyTypeFilterSelect: document.getElementById('historyTypeFilterSelect'),
    historyResyncBtn: document.getElementById('historyResyncBtn'),
    historyExportCsvBtn: document.getElementById('historyExportCsvBtn'),
    historyExportJsonBtn: document.getElementById('historyExportJsonBtn'),
    historyDbList: document.getElementById('historyDbList'),
    infoUseAdvice: document.getElementById('infoUseAdvice'),
    openAdvisorBtn: document.getElementById('openAdvisorBtn'),
    advisorModal: document.getElementById('advisorModal'),
    closeAdvisorModalBtn: document.getElementById('closeAdvisorModalBtn'),
    advisorBudgetSummary: document.getElementById('advisorBudgetSummary'),
    advisorQuickPicks: document.getElementById('advisorQuickPicks'),
    advisorComparisonBody: document.getElementById('advisorComparisonBody'),
    customPromptChips: document.getElementById('customPromptChips'),
    savePresetChipBtn: document.getElementById('savePresetChipBtn'),
    customChipCreator: document.getElementById('customChipCreator'),
    customChipLabelInput: document.getElementById('customChipLabelInput'),
    confirmSaveChipBtn: document.getElementById('confirmSaveChipBtn'),
    cancelSaveChipBtn: document.getElementById('cancelSaveChipBtn'),
    lastImageGroup: document.getElementById('lastImageGroup'),
    lastImageDropzone: document.getElementById('lastImageDropzone'),
    lastImageFileInput: document.getElementById('lastImageFileInput'),
    lastDropzonePrompt: document.getElementById('lastDropzonePrompt'),
    lastImagePreviewContainer: document.getElementById('lastImagePreviewContainer'),
    lastImagePreview: document.getElementById('lastImagePreview'),
    removeLastImageBtn: document.getElementById('removeLastImageBtn'),
    lastImageUrlInput: document.getElementById('lastImageUrlInput'),
    loadLastUrlBtn: document.getElementById('loadLastUrlBtn'),
    multiImgGrid: document.getElementById('multiImgGrid'),
    multiImageUrlInput: document.getElementById('multiImageUrlInput'),
    addMultiImageUrlBtn: document.getElementById('addMultiImageUrlBtn'),
    addMoreImagesBtn: document.getElementById('addMoreImagesBtn'),
    multiFileInput: document.getElementById('multiFileInput'),
    extendVideoBtn: document.getElementById('extendVideoBtn'),
    historyGalleryFilterPills: document.getElementById('historyGalleryFilterPills'),
    openCompareBtn: document.getElementById('openCompareBtn'),
    compareCountBadge: document.getElementById('compareCountBadge'),
    compareModal: document.getElementById('compareModal'),
    compareSubtitle: document.getElementById('compareSubtitle'),
    syncPlayCompareVideosBtn: document.getElementById('syncPlayCompareVideosBtn'),
    clearComparePinsBtn: document.getElementById('clearComparePinsBtn'),
    closeCompareModalBtn: document.getElementById('closeCompareModalBtn'),
    compareGrid: document.getElementById('compareGrid'),
    negativePromptGroup: document.getElementById('negativePromptGroup'),
    negativePromptInput: document.getElementById('negativePromptInput'),
    r2vRefChips: document.getElementById('r2vRefChips'),
    refVideosGroup: document.getElementById('refVideosGroup'),
    refVideosLabel: document.getElementById('refVideosLabel'),
    refVideoDropzone: document.getElementById('refVideoDropzone'),
    refVideoFileInput: document.getElementById('refVideoFileInput'),
    refVideoUrlInput: document.getElementById('refVideoUrlInput'),
    addRefVideoUrlBtn: document.getElementById('addRefVideoUrlBtn'),
    useActiveRefVideoBtn: document.getElementById('useActiveRefVideoBtn'),
    refVideosList: document.getElementById('refVideosList'),
    refVideosInput: document.getElementById('refVideosInput'),
    refAudiosGroup: document.getElementById('refAudiosGroup'),
    refAudiosLabel: document.getElementById('refAudiosLabel'),
    refAudioFileInput: document.getElementById('refAudioFileInput'),
    refAudioUrlInput: document.getElementById('refAudioUrlInput'),
    addRefAudioUrlBtn: document.getElementById('addRefAudioUrlBtn'),
    uploadRefAudioBtn: document.getElementById('uploadRefAudioBtn'),
    refAudiosList: document.getElementById('refAudiosList'),
    openSourceVideoTimelineBtn: document.getElementById('openSourceVideoTimelineBtn'),
    videoTimelineGroup: document.getElementById('videoTimelineGroup'),
    toggleTimelineExtractorBtn: document.getElementById('toggleTimelineExtractorBtn'),
    timelineExtractorBody: document.getElementById('timelineExtractorBody'),
    timelineChevron: document.getElementById('timelineChevron'),
    timelineVideoFileInput: document.getElementById('timelineVideoFileInput'),
    browseTimelineVideoBtn: document.getElementById('browseTimelineVideoBtn'),
    loadActiveToTimelineBtn: document.getElementById('loadActiveToTimelineBtn'),
    timelineMetaReadout: document.getElementById('timelineMetaReadout'),
    timelineStage: document.getElementById('timelineStage'),
    timelineVideoPlayer: document.getElementById('timelineVideoPlayer'),
    timelineFilmstrip: document.getElementById('timelineFilmstrip'),
    timelineScrubber: document.getElementById('timelineScrubber'),
    timelineTimecode: document.getElementById('timelineTimecode'),
    tlStepStartBtn: document.getElementById('tlStepStartBtn'),
    tlStepBack1sBtn: document.getElementById('tlStepBack1sBtn'),
    tlStepBack1fBtn: document.getElementById('tlStepBack1fBtn'),
    tlStepFwd1fBtn: document.getElementById('tlStepFwd1fBtn'),
    tlStepFwd1sBtn: document.getElementById('tlStepFwd1sBtn'),
    tlStepEndBtn: document.getElementById('tlStepEndBtn'),
    extractFrameSourceBtn: document.getElementById('extractFrameSourceBtn'),
    extractFrameLastBtn: document.getElementById('extractFrameLastBtn'),
    extractFrameRefBtn: document.getElementById('extractFrameRefBtn'),
    inputQualityAdvisory: document.getElementById('inputQualityAdvisory'),
    inputQualityAdvisoryText: document.getElementById('inputQualityAdvisoryText'),
    preUpscaleLabel: document.getElementById('preUpscaleLabel'),
    preUpscaleCheckbox: document.getElementById('preUpscaleCheckbox'),
    preUpscaleLabelText: document.getElementById('preUpscaleLabelText'),
    routeToVideoUpscalerBtn: document.getElementById('routeToVideoUpscalerBtn'),
    openViewerTimelineBtn: document.getElementById('openViewerTimelineBtn'),
    useOutputAsR2vBtn: document.getElementById('useOutputAsR2vBtn'),
    advancedMotionGroup: document.getElementById('advancedMotionGroup'),
    movementAmpCol: document.getElementById('movementAmpCol'),
    movementAmpSelect: document.getElementById('movementAmpSelect'),
    shotTypeCol: document.getElementById('shotTypeCol'),
    shotTypeSelect: document.getElementById('shotTypeSelect'),
    presetCol: document.getElementById('presetCol'),
    presetSelect: document.getElementById('presetSelect'),
    cameraFixedCol: document.getElementById('cameraFixedCol'),
    cameraFixedCheckbox: document.getElementById('cameraFixedCheckbox'),
    openContainingFolderBtn: document.getElementById('openContainingFolderBtn'),
    openContainingFolderTabBtn: document.getElementById('openContainingFolderTabBtn'),
    themeMenuBtn: document.getElementById('themeMenuBtn'),
    themePopover: document.getElementById('themePopover'),
    themeSwatches: document.getElementById('themeSwatches'),
    densitySwitch: document.getElementById('densitySwitch'),
    viewerHeightSwitch: document.getElementById('viewerHeightSwitch'),
    safetyShieldBanner: document.getElementById('safetyShieldBanner'),
    safetyShieldText: document.getElementById('safetyShieldText'),
    safetySwitchBtn: document.getElementById('safetySwitchBtn'),
    beforeAfterToggleBtn: document.getElementById('beforeAfterToggleBtn'),
    grabFrameEditBtn: document.getElementById('grabFrameEditBtn'),
    grabLastFrameI2VBtn: document.getElementById('grabLastFrameI2VBtn'),
    reuseActiveBtn: document.getElementById('reuseActiveBtn'),
    beforeAfterStage: document.getElementById('beforeAfterStage'),
    baBeforeImg: document.getElementById('baBeforeImg'),
    baAfterImg: document.getElementById('baAfterImg'),
    baBeforeClip: document.getElementById('baBeforeClip'),
    baDivider: document.getElementById('baDivider'),
    gallerySizePills: document.getElementById('gallerySizePills'),
    toggleBulkSelectBtn: document.getElementById('toggleBulkSelectBtn'),
    bulkStitchSelectedBtn: document.getElementById('bulkStitchSelectedBtn'),
    bulkVideoCount: document.getElementById('bulkVideoCount'),
    bulkDeleteSelectedBtn: document.getElementById('bulkDeleteSelectedBtn'),
    bulkSelectedCount: document.getElementById('bulkSelectedCount'),
    updateNotifierBtn: document.getElementById('updateNotifierBtn'),
    updateNotifierLabel: document.getElementById('updateNotifierLabel'),
    clearSourceVideoBtn: document.getElementById('clearSourceVideoBtn'),
    tlSetTrimStartBtn: document.getElementById('tlSetTrimStartBtn'),
    tlSetTrimEndBtn: document.getElementById('tlSetTrimEndBtn'),
    tlRunTrimBtn: document.getElementById('tlRunTrimBtn'),
    trimStartLabel: document.getElementById('trimStartLabel'),
    trimEndLabel: document.getElementById('trimEndLabel'),
    batchSeedsSelect: document.getElementById('batchSeedsSelect'),
    postChainSelect: document.getElementById('postChainSelect'),
    batchMatrixHint: document.getElementById('batchMatrixHint'),
    studioToastContainer: document.getElementById('studioToastContainer')
  };

  // Mask Canvas Context
  let canvasCtx = null;

  // Initialize
  async function init() {
    applyDesignPreferences();
    if (el.economyDefaultsCheckbox) {
      el.economyDefaultsCheckbox.checked = state.economyDefaultsEnabled;
    }
    loadCustomPromptChips();
    renderCustomPromptChips();
    loadLocalHistory();
    setupCanvas();
    setupResizer();
    setupEventListeners();
    await Promise.all([
      fetchBalance(),
      fetchModels(),
      fetchSavedOutputs(),
      fetchHistoryStatsForInsights(),
      checkForAppUpdate()
    ]);
  }

  // Draggable Splitter Implementation
  function setupResizer() {
    const resizer = document.getElementById('layoutResizer');
    const controlPanel = document.getElementById('controlPanel');
    if (!resizer || !controlPanel) return;

    // Load saved width from localStorage
    const savedWidth = localStorage.getItem('wavespeed_panel_width');
    if (savedWidth) {
      const w = parseInt(savedWidth, 10);
      if (w >= 340 && w <= window.innerWidth * 0.85) {
        controlPanel.style.width = `${w}px`;
      }
    }

    let isDragging = false;
    let startX = 0;
    let startWidth = 0;

    resizer.addEventListener('mousedown', (e) => {
      isDragging = true;
      startX = e.clientX;
      startWidth = controlPanel.getBoundingClientRect().width;
      resizer.classList.add('active');
      document.body.classList.add('resizing');
      e.preventDefault();
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const deltaX = e.clientX - startX;
      let newWidth = startWidth + deltaX;
      const minW = 340;
      const maxW = Math.max(minW, window.innerWidth - 380);

      newWidth = Math.max(minW, Math.min(newWidth, maxW));
      controlPanel.style.width = `${newWidth}px`;
    });

    window.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        resizer.classList.remove('active');
        document.body.classList.remove('resizing');
        const currentWidth = controlPanel.getBoundingClientRect().width;
        localStorage.setItem('wavespeed_panel_width', Math.round(currentWidth));
      }
    });
  }

  // Canvas Setup
  function setupCanvas() {
    const canvas = el.maskCanvas;
    canvasCtx = canvas.getContext('2d');
    canvas.width = 400;
    canvas.height = 300;

    canvasCtx.fillStyle = '#000000';
    canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    window.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseleave', stopDrawing);
  }

  function startDrawing(e) {
    state.isDrawing = true;
    draw(e);
  }

  function draw(e) {
    if (!state.isDrawing) return;
    state.hasDrawnMask = true;
    const rect = el.maskCanvas.getBoundingClientRect();
    const scaleX = el.maskCanvas.width / rect.width;
    const scaleY = el.maskCanvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    canvasCtx.lineWidth = parseInt(el.brushSize.value, 10);
    canvasCtx.lineCap = 'round';
    canvasCtx.lineJoin = 'round';
    canvasCtx.strokeStyle = '#ffffff';

    canvasCtx.lineTo(x, y);
    canvasCtx.stroke();
    canvasCtx.beginPath();
    canvasCtx.moveTo(x, y);
  }

  function stopDrawing() {
    if (!state.isDrawing) return;
    state.isDrawing = false;
    canvasCtx.beginPath();
    if (state.selectedModel) updateModelInfo(state.selectedModel);
  }

  function clearMask() {
    state.hasDrawnMask = false;
    canvasCtx.fillStyle = '#000000';
    canvasCtx.fillRect(0, 0, el.maskCanvas.width, el.maskCanvas.height);
    if (state.selectedModel) updateModelInfo(state.selectedModel);
  }

  function applyOutputsDirUi(nextDir) {
    if (!nextDir || typeof nextDir !== 'string') return;
    state.outputsDir = nextDir;
    if (el.outputsPathLabel) {
      el.outputsPathLabel.textContent = `Auto-saved to ${nextDir}`;
    }
    if (el.openOutputsFolderBtn) {
      el.openOutputsFolderBtn.title = `Open outputs folder (${nextDir})`;
    }
    if (el.outputsFolderPathCode) {
      el.outputsFolderPathCode.textContent = nextDir;
    }
    if (el.outputsDirInput && document.activeElement !== el.outputsDirInput) {
      el.outputsDirInput.value = nextDir;
    }
  }

  function openApiKeyModal(isOnboarding = false) {
    if (!el.apiKeyModal) return;
    const titleEl = document.getElementById('apiKeyModalTitle');
    const introEl = document.getElementById('apiKeyModalIntro');
    if (titleEl) {
      titleEl.textContent = isOnboarding
        ? '🔑 Welcome — Enter Your WaveSpeed API Key'
        : 'WaveSpeed API Settings';
    }
    if (introEl) {
      introEl.innerHTML = isOnboarding
        ? 'Paste your personal WaveSpeed API key below to check your balance and start generating. It stays 100% local in <code>.studio-config.json</code>.'
        : 'Your API key is saved only on your computer (<code>.studio-config.json</code>) and used directly for WaveSpeed image and video requests.';
    }
    if (el.cancelModalBtn) {
      el.cancelModalBtn.textContent = isOnboarding ? 'Browse Models First' : 'Cancel';
    }
    if (el.outputsDirInput) {
      el.outputsDirInput.value = state.outputsDir || '';
    }
    const discountInput = document.getElementById('accountDiscountInput');
    if (discountInput) discountInput.value = state.accountDiscount;
    if (el.spendGuardEnabledInput) el.spendGuardEnabledInput.checked = state.spendGuardEnabled;
    if (el.spendGuardThresholdInput) el.spendGuardThresholdInput.value = state.spendGuardThreshold.toFixed(2);
    el.apiKeyModal.style.display = 'flex';
    if (typeof el.apiKeyInput?.focus === 'function') {
      setTimeout(() => el.apiKeyInput?.focus?.(), 60);
    }
  }

  // Fetch Balance
  async function fetchBalance() {
    try {
      el.balanceValue.textContent = '...';
      const cfgRes = await fetch('/api/config').catch(() => null);
      if (cfgRes && cfgRes.ok) {
        const cfg = await cfgRes.json().catch(() => null);
        if (cfg && cfg.outputsDir) {
          applyOutputsDirUi(cfg.outputsDir);
        }
        if (cfg && cfg.hasApiKey === false) {
          state.balance = null;
          el.balanceValue.textContent = 'No Key';
          updateSidebarBalanceProjection();
          if (!state.promptedForApiKey) {
            state.promptedForApiKey = true;
            openApiKeyModal(true);
          }
          return;
        }
      }
      const res = await fetch('/api/balance');
      const data = await res.json();
      if (res.status === 401) {
        state.balance = null;
        el.balanceValue.textContent = 'No Key';
        updateSidebarBalanceProjection();
        if (!state.promptedForApiKey) {
          state.promptedForApiKey = true;
          openApiKeyModal(true);
        }
        return;
      }
      if (data.data && typeof data.data.balance !== 'undefined') {
        const balNum = parseFloat(data.data.balance) || 0;
        state.balance = balNum;
        el.balanceValue.textContent = `$${balNum.toFixed(4)}`;
        updateSidebarBalanceProjection();
        if (state.selectedModel) updateModelInfo(state.selectedModel);
      } else {
        el.balanceValue.textContent = '$0.00';
      }
    } catch (err) {
      console.warn('Balance fetch failed:', err);
      el.balanceValue.textContent = 'Error';
    }
  }

  // Model Category Classifier Helper
  function isModelInCategory(m, category) {
    if (category === 'ref-to-video') {
      return Boolean(m.isReferenceToVideo || m.category === 'ref-to-video');
    }
    if (category === 'image-to-video') {
      return Boolean(m.isImageToVideo);
    }
    if (category === 'video-gen') {
      return Boolean(m.isTextToVideoOrEdit);
    }
    if (category === 'image-edit') {
      return Boolean(m.isImageEdit);
    }
    if (category === 'image-gen') {
      return Boolean(m.isImageGen);
    }
    if (category === 'utility') {
      return Boolean(m.isUtility);
    }
    return true;
  }

  function isR2VModel(model) {
    if (!model) return false;
    return Boolean(
      model.isReferenceToVideo ||
      model.category === 'ref-to-video' ||
      String(model.type || '').toLowerCase() === 'reference-to-video' ||
      String(model.model_id || '').toLowerCase().includes('reference-to-video')
    );
  }

  function getRefVideosSchemaKey(props, model) {
    if (!props || typeof props !== 'object') return null;
    for (const k of ['reference_videos', 'videos', 'ref_videos']) {
      if (k in props && !props[k]?.['x-hidden']) return k;
    }
    if (isR2VModel(model) && 'reference_files' in props && !props.reference_files?.['x-hidden']) {
      return 'reference_files';
    }
    return null;
  }

  function getRefAudiosSchemaKey(props) {
    if (!props || typeof props !== 'object') return null;
    for (const k of ['reference_audios', 'audios', 'audio']) {
      if (k in props && !props[k]?.['x-hidden']) return k;
    }
    return null;
  }

  function getResolutionSchemaKey(props) {
    if (!props || typeof props !== 'object') return null;
    if ('resolution' in props && !props.resolution?.['x-hidden']) return 'resolution';
    if ('target_resolution' in props && !props.target_resolution?.['x-hidden']) return 'target_resolution';
    return null;
  }

  function getSingleImageSchemaKey(props) {
    if (!props || typeof props !== 'object') return null;
    if ('image' in props && !props.image?.['x-hidden']) return 'image';
    if ('face_image' in props && !props.face_image?.['x-hidden']) return 'face_image';
    return null;
  }

  // Fetch Models
  async function fetchModels() {
    try {
      el.modelAutocompleteInput.placeholder = 'Loading models...';
      const res = await fetch('/api/models?refresh=true');
      const data = await res.json();
      state.models = data.data || [];
      
      updatePlaceholderForCategory();
      
      // Select first model for active tab
      const catModels = state.models.filter(m => isModelInCategory(m, state.currentCategory));
      if (catModels.length > 0) {
        const topPick = catModels.find(m => m.isPinned) || catModels[0];
        selectModel(topPick.model_id, false);
      } else if (state.models.length > 0) {
        selectModel(state.models[0].model_id, false);
      }

      filterAndRenderAutocomplete();
    } catch (err) {
      console.error('Failed to load models:', err);
      el.modelAutocompleteInput.placeholder = 'Error loading models';
    }
  }

  function updatePlaceholderForCategory() {
    const cat = state.currentCategory;
    if (cat === 'ref-to-video') {
      el.modelAutocompleteInput.placeholder = 'Search Ref → Video (Wan 3.0, Seedance 2.5, Kling 4.0, MiniMax H3)...';
    } else if (cat === 'image-to-video') {
      el.modelAutocompleteInput.placeholder = 'Search Image-to-Video models (Seedance 2.5, H3, Kling, WAN)...';
    } else if (cat === 'image-gen') {
      el.modelAutocompleteInput.placeholder = 'Search Text-to-Image models (flux, recraft, nano-banana)...';
    } else if (cat === 'image-edit') {
      el.modelAutocompleteInput.placeholder = 'Search Image Edit models (H3 edit, z-image, inpaint)...';
    } else if (cat === 'video-gen') {
      el.modelAutocompleteInput.placeholder = 'Search Video & Edit models (T2V, Video Edit, Video Extend)...';
    } else if (cat === 'utility') {
      el.modelAutocompleteInput.placeholder = 'Search Tools (Video/Image Upscalers, background removal, blur)...';
    }
  }

  // Helpers for text highlighting
  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function highlightMatches(text, query) {
    if (!query) return escapeHtml(text);
    const tokens = query.split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return escapeHtml(text);
    const pattern = tokens.map(escapeRegex).join('|');
    const regex = new RegExp(`(${pattern})`, 'gi');
    return escapeHtml(text).replace(regex, '<span class="combobox-highlight">$1</span>');
  }

  const AUDIO_SCHEMA_KEYS = ['generate_audio', 'sound', 'save_audio', 'keep_audio', 'keep_original_sound'];

  function getAudioSchemaKey(props) {
    if (!props || typeof props !== 'object') return null;
    for (const key of AUDIO_SCHEMA_KEYS) {
      if (key in props && !props[key]?.['x-hidden']) {
        return key;
      }
    }
    return null;
  }

  function isVideoTabModel(model) {
    if (!model) return false;
    return Boolean(model.isReferenceToVideo || model.isImageToVideo || model.isTextToVideoOrEdit || model.category === 'ref-to-video');
  }

  function updateAudioControlHint(model, audioKey, props) {
    if (!el.audioCostHint || !el.audioRow) return;
    if (audioKey) {
      const affectsPrice = Boolean(model?.formula && new RegExp(`\\b${audioKey}\\b`).test(model.formula));
      el.audioCostHint.textContent = affectsPrice ? 'Uncheck saves 33–50%' : 'Same price (uncheck for silent)';
      el.audioCostHint.style.color = affectsPrice ? 'var(--accent-emerald)' : 'var(--text-sub)';
    } else if (isVideoTabModel(model)) {
      const noSchema = !props || Object.keys(props).length === 0;
      el.audioCostHint.textContent = noSchema ? 'Enter API key to load toggles' : 'Fixed audio / no toggle on model API';
      el.audioCostHint.style.color = 'var(--text-sub)';
    }
  }

  function readAudioParamValue(props, key) {
    const activeAudioKey = getAudioSchemaKey(props);
    if (activeAudioKey === key && el.audioCheckbox) {
      return Boolean(el.audioCheckbox.checked);
    }
    return Boolean(props?.[key]?.default ?? false);
  }

  // Evaluate exact WaveSpeed JSONata pricing formula (in micro-dollars -> returns USD)
  function evaluateWaveSpeedFormula(formulaStr, basePriceMicro, params = {}) {
    if (!formulaStr || !formulaStr.trim()) {
      return null;
    }
    try {
      let expr = formulaStr.trim();
      const m = expr.match(/^\{\s*"total_price"\s*:\s*([\s\S]+)\}$/);
      if (m) expr = m[1].trim();

      expr = expr.replace(/get_duration\(\s*([a-zA-Z0-9_]+)(?:\s*,([^)]*))?\)/g, (_, targetArg, optRaw) => {
        if (!optRaw || !optRaw.trim()) return `__get_duration(${targetArg}, {})`;
        const kvParts = [];
        for (const mOpt of optRaw.matchAll(/\b(min|max|total)\s*=\s*([0-9.]+)/g)) {
          kvParts.push(`${mOpt[1]}: ${mOpt[2]}`);
        }
        return `__get_duration(${targetArg}, { ${kvParts.join(', ')} })`;
      });
      expr = expr.replace(/:=/g, '__ASSIGN__');
      expr = expr.replace(/(?<![!<>=])=(?!=)/g, '===');
      expr = expr.replace(/__ASSIGN__/g, '=');
      expr = expr.replace(/;/g, ',');
      expr = expr.replace(/\band\b/g, '&&').replace(/\bor\b/g, '||');
      expr = expr.replace(/\$count\b/g, '__count');
      expr = expr.replace(/\$min\b/g, '__min');
      expr = expr.replace(/\$max\b/g, '__max');
      expr = expr.replace(/\$ceil\b/g, '__ceil');
      expr = expr.replace(/\$number\b/g, '__number');
      expr = expr.replace(/\$string\b/g, '__string');
      expr = expr.replace(/\$lowercase\b/g, '__lowercase');
      expr = expr.replace(/\$exists\b/g, '__exists');

      const context = {
        base_price: basePriceMicro,
        duration: Number(params.duration ?? 5),
        resolution: String(params.resolution ?? '720p'),
        size: String(params.size ?? '1024*1024'),
        quality: String(params.quality ?? 'medium'),
        output_format: String(params.output_format ?? 'png'),
        num_images: Number(params.num_images ?? 1),
        sound: Boolean(params.sound ?? false),
        generate_audio: Boolean(params.generate_audio ?? false),
        save_audio: Boolean(params.save_audio ?? false),
        keep_audio: Boolean(params.keep_audio ?? false),
        keep_original_sound: Boolean(params.keep_original_sound ?? false),
        enable_web_search: Boolean(params.enable_web_search ?? false),
        enable_image_search: Boolean(params.enable_image_search ?? false),
        images: Array.isArray(params.images) ? params.images : ['img1'],
        image: params.image !== undefined ? params.image : 'img1',
        mask_image: params.mask_image ?? '',
        markup_image: params.markup_image ?? '',
        video: params.video ?? '',
        videos: Array.isArray(params.videos) ? params.videos : [],
        ref_videos: Array.isArray(params.ref_videos) ? params.ref_videos : [],
        reference_videos: Array.isArray(params.reference_videos) ? params.reference_videos : [],
        reference_images: Array.isArray(params.reference_images) ? params.reference_images : [],
        reference_files: Array.isArray(params.reference_files) ? params.reference_files : [],
        reference_audios: Array.isArray(params.reference_audios) ? params.reference_audios : [],
        audios: Array.isArray(params.audios) ? params.audios : [],
        target_resolution: String(params.target_resolution ?? params.resolution ?? '1080p'),
        max_images: params.max_images !== undefined ? Number(params.max_images) : undefined,
        audio: params.audio ?? '',
        __get_duration: (media, opts = {}) => {
          const clampDur = (sec) => {
            let v = Number(sec) || 0;
            if (typeof opts.min === 'number' && !isNaN(opts.min)) v = Math.max(opts.min, v);
            if (typeof opts.max === 'number' && !isNaN(opts.max)) v = Math.min(opts.max, v);
            return v;
          };
          if (Array.isArray(media)) {
            if (media.length === 0) return 0;
            const durs = (Array.isArray(params.reference_video_durations) && params.reference_video_durations.length === media.length)
              ? params.reference_video_durations.map(s => clampDur(s || Number(params.duration ?? 5)))
              : media.map(() => clampDur(Number(params.video_duration ?? params.duration ?? 5)));
            let total = durs.reduce((acc, sec) => acc + sec, 0);
            if (typeof opts.total === 'number' && !isNaN(opts.total)) total = Math.min(opts.total, total);
            return total;
          }
          if (media === '' && params.strictEmptyVideoDuration) return 0;
          return clampDur(Number(params.video_duration ?? params.duration ?? 5));
        },
        __count: (arr) => Array.isArray(arr) ? arr.length : (arr ? 1 : 0),
        __min: (arr) => Math.min(...(Array.isArray(arr) ? arr : [arr])),
        __max: (arr) => Math.max(...(Array.isArray(arr) ? arr : [arr])),
        __ceil: (x) => Math.ceil(Number(x) || 0),
        __number: (x) => Number(x) || 0,
        __string: (x) => String(x ?? ''),
        __lowercase: (s) => String(s ?? '').toLowerCase(),
        __exists: (x) => Array.isArray(x) ? x.length > 0 : (x !== undefined && x !== null && x !== '')
      };

      // Auto-bind any additional identifier referenced in expr to avoid ReferenceError on new model inputs
      const reserved = new Set(['true', 'false', 'null', 'undefined', 'let', 'return', 'NaN', 'Infinity']);
      const stripped = expr.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, '""');
      for (const idMatch of stripped.matchAll(/\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g)) {
        const ident = idMatch[1];
        if (!reserved.has(ident) && !(ident in context)) {
          context[ident] = params[ident] ?? undefined;
        }
      }

      const varMatches = [...expr.matchAll(/(\$[a-zA-Z0-9_]+)\s*=/g)].map(x => x[1]);
      const uniqueVars = [...new Set(varMatches)];
      const varDecl = uniqueVars.length > 0 ? `let ${uniqueVars.join(', ')}; ` : '';

      const keys = Object.keys(context);
      const vals = Object.values(context);
      const fn = new Function(...keys, `"use strict"; ${varDecl} return (${expr});`);
      const microResult = fn(...vals);
      if (typeof microResult === 'number' && !isNaN(microResult) && microResult >= 0) {
        return microResult / 1e6;
      }
    } catch (err) {
      console.warn('Formula evaluation fallback for model:', err.message);
    }
    return null;
  }

  function getFallbackResolutionMultiplier(model, resolutionVal) {
    if (!resolutionVal) return 1.0;
    const r = String(resolutionVal).toLowerCase();
    const resProp = model?.schema?.properties?.resolution;
    const resEnum = Array.isArray(resProp?.enum) ? resProp.enum.map(x => String(x).toLowerCase()) : [];
    const is480Native = resProp?.default === '480p' && !resEnum.includes('1080p') && !resEnum.includes('4k');
    if (r === '360p') return 0.35;
    if (r === '480p' || r === '540p') return is480Native ? 1.0 : 0.50;
    if (r === '720p') return is480Native ? 2.0 : 1.0;
    if (r === '768p' || r === '1k' || r === '1.5k') return 1.0;
    if (r === '1080p') return 2.0;
    if (r === '2k') return (model.isImageGen || model.isImageEdit) ? 1.5 : 2.5;
    if (r === '4k') return (model.isImageGen || model.isImageEdit) ? 3.0 : 5.0;
    return 1.0;
  }

  // Check if a video model's base_price is a per-second rate vs a flat/tiered clip price
  function isModelPerSecond(model) {
    if (!model) return false;
    const props = model.schema?.properties || {};
    const isVideoModality = model.isReferenceToVideo || model.isImageToVideo || model.isTextToVideoOrEdit ||
      model.category === 'ref-to-video' || model.category === 'video-gen';
    if (!isVideoModality || !('duration' in props)) return false;
    // Explicit empty formula in WaveSpeed RSC means flat base_price per generation
    if (model.has_formula && (!model.formula || !model.formula.trim())) return false;
    // Tiered fixed-duration formulas like (duration = 10) ? 320000 : 190000 are per-clip, not per-second
    if (model.formula && /^\{\s*"total_price"\s*:\s*\(\s*duration\s*=\s*\d+\s*\)\s*\?\s*\d+\s*:\s*\d+\s*\}$/.test(model.formula.trim())) {
      return false;
    }
    return true;
  }

  // Core Pricing Calculator for any parameter set
  function calculateModelCost(model, params = {}) {
    if (!model) return { basePrice: 0, finalPrice: 0, hasDiscount: false, percentOff: 0, isPerSecond: false };
    const props = model.schema?.properties || {};
    const isPerSecond = isModelPerSecond(model);
    const basePriceMicro = model.base_price_micro || Math.round((model.base_price || 0) * 1e6);

    let scaledBase = null;
    if (model.formula && model.formula.trim()) {
      scaledBase = evaluateWaveSpeedFormula(model.formula, basePriceMicro, params);
    } else if (model.has_formula && (!model.formula || !model.formula.trim())) {
      // Explicit empty formula on WaveSpeed means flat base_price per run
      scaledBase = model.base_price || 0;
    }

    if (scaledBase === null) {
      // Fallback when model formula is not yet fetched
      let base = model.base_price || 0;
      const numMult = ('num_images' in props) ? Math.max(1, Number(params.num_images ?? props.num_images?.default ?? 1)) : 1;
      if (isPerSecond) {
        const dur = Number(params.duration ?? (props.duration?.default || 5));
        const resMult = (!model.has_formula && 'resolution' in props)
          ? getFallbackResolutionMultiplier(model, params.resolution)
          : 1.0;
        scaledBase = base * dur * resMult;
      } else {
        scaledBase = base * numMult;
      }
    }

    scaledBase = parseFloat(scaledBase.toFixed(4));
    const modelDisc = model.discount_percent || 0;
    const extraDisc = state.accountDiscount > 0 ? (state.accountDiscount / 100) : 0;
    const totalDisc = Math.min(0.9, modelDisc + extraDisc);
    const hasDiscount = totalDisc > 0;
    const finalPrice = hasDiscount ? parseFloat((scaledBase * (1 - totalDisc)).toFixed(4)) : scaledBase;
    const percentOff = Math.round(totalDisc * 100);

    return {
      basePrice: scaledBase,
      finalPrice,
      hasDiscount,
      percentOff,
      isPerSecond
    };
  }

  // Calculate catalog item pricing (base rate + minimum economical run cost)
  function getCatalogItemPricing(model) {
    const props = model.schema?.properties || {};
    const isPerSecond = isModelPerSecond(model);
    const modelDisc = model.discount_percent || 0;
    const extraDisc = state.accountDiscount > 0 ? (state.accountDiscount / 100) : 0;
    const totalDisc = Math.min(0.9, modelDisc + extraDisc);
    const hasDiscount = totalDisc > 0;
    const percentOff = Math.round(totalDisc * 100);

    const rawBaseRate = model.base_price || 0;
    const finalBaseRate = hasDiscount ? parseFloat((rawBaseRate * (1 - totalDisc)).toFixed(4)) : rawBaseRate;

    // Also compute minimum economical run cost (cheapest resolution + shortest duration + default/min quality & num_images)
    const resEnums = Array.isArray(props.resolution?.enum) && props.resolution.enum.length > 0
      ? props.resolution.enum
      : [props.resolution?.default || '720p'];
    let minDur = 5;
    if (props.duration) {
      if (Array.isArray(props.duration.enum) && props.duration.enum.length > 0) {
        const pos = props.duration.enum.map(Number).filter(n => !isNaN(n) && n > 0);
        minDur = pos.length > 0 ? Math.min(...pos) : Number(props.duration.default ?? 5);
      } else if (typeof props.duration.minimum === 'number') {
        minDur = props.duration.minimum > 0 ? props.duration.minimum : (props.duration.default ?? 5);
      } else if (typeof props.duration.default === 'number') {
        minDur = props.duration.default;
      }
    }

    let minNumImages = 1;
    if (props.num_images) {
      if (Array.isArray(props.num_images.enum) && props.num_images.enum.length > 0) {
        const posImgs = props.num_images.enum.map(Number).filter(n => !isNaN(n) && n > 0);
        minNumImages = posImgs.length > 0 ? Math.min(...posImgs) : 1;
      } else if (typeof props.num_images.minimum === 'number') {
        minNumImages = Math.max(1, props.num_images.minimum);
      } else if (typeof props.num_images.default === 'number') {
        minNumImages = Math.max(1, props.num_images.default);
      }
    }

    let cheapestQuality = props.quality?.default ?? 'medium';
    if (Array.isArray(props.quality?.enum) && props.quality.enum.length > 0) {
      if (props.quality.enum.includes('very_low')) cheapestQuality = 'very_low';
      else if (props.quality.enum.includes('low')) cheapestQuality = 'low';
      else cheapestQuality = props.quality.enum[0];
    }

    const refImgs = ('reference_images' in props) ? ['img1'] : [];
    let minRes = resEnums[0];
    let minRun = null;
    for (const candidateRes of resEnums) {
      const candidateCost = calculateModelCost(model, {
        resolution: candidateRes,
        duration: (!('duration' in props) || (props.duration?.['x-hidden'] && props.duration?.default === undefined)) ? 0 : minDur,
        size: props.size?.default || '1024*1024',
        quality: cheapestQuality,
        output_format: props.output_format?.default || 'png',
        num_images: minNumImages,
        max_images: props.max_images?.default,
        enable_web_search: Boolean(props.enable_web_search?.default ?? false),
        enable_image_search: Boolean(props.enable_image_search?.default ?? false),
        generate_audio: Boolean(props.generate_audio?.default ?? false),
        sound: Boolean(props.sound?.default ?? false),
        images: ['img1'],
        reference_images: refImgs
      });
      if (!minRun || candidateCost.finalPrice < minRun.finalPrice) {
        minRun = candidateCost;
        minRes = candidateRes;
      }
    }

    return {
      rawBaseRate,
      finalBaseRate,
      hasDiscount,
      percentOff,
      isPerSecond,
      minRunCost: minRun.finalPrice,
      minRes,
      minDur
    };
  }

  function getPlannedInputImageCount(model = state.selectedModel) {
    if (!model) return 0;
    const props = model.schema?.properties || {};
    const reqList = model.schema?.required || [];
    const singleKey = getSingleImageSchemaKey(props);
    const hasSingleAttached = Boolean(state.sourceImage || el.imageUrlInput?.value.trim());
    const singleRequired = Boolean(singleKey && (reqList.includes(singleKey) || model.isImageToVideo));
    const singleCount = (singleKey && (hasSingleAttached || singleRequired)) || model.isImageToVideo ? 1 : 0;

    const extraCount = Array.isArray(state.extraImages) ? state.extraImages.length : 0;
    const hasArrayImgs = Boolean('images' in props || 'reference_images' in props || (isR2VModel(model) && 'reference_files' in props));
    const arrayRequired = reqList.includes('images') || reqList.includes('reference_images') || reqList.includes('reference_files');
    const arrayCount = hasArrayImgs
      ? (extraCount > 0 ? extraCount : (singleCount === 0 && arrayRequired ? 1 : 0))
      : extraCount;
    return singleCount + arrayCount;
  }

  function buildDummyImageArray(count) {
    if (count <= 0) return [];
    return Array.from({ length: count }, (_, i) => `img${i + 1}`);
  }

  function getPreUpscaleUnitCost() {
    const esr = state.models.find(m => m.model_id === 'wavespeed-ai/real-esrgan');
    return esr ? Number(esr.effective_price ?? esr.base_price ?? 0.0024) : 0.0024;
  }

  function getPlannedRefVideoMeta() {
    const activeVids = Array.isArray(state.refVideos) ? state.refVideos : [];
    const manualLines = (el.refVideosInput && el.refVideosInput.style.display !== 'none')
      ? el.refVideosInput.value.split(/[\r\n,]+/).map(s => s.trim()).filter(Boolean)
      : [];
    const total = activeVids.length > 0 ? activeVids.length : manualLines.length;
    const dummyVids = Array.from({ length: total }, (_, i) => `vid${i + 1}`);
    const durations = activeVids.length > 0
      ? activeVids.map(v => Math.max(1, Math.ceil(Number(v.duration) || Number(el.durationSelect?.value) || 5)))
      : dummyVids.map(() => Number(el.durationSelect?.value) || 5);
    const totalSec = durations.reduce((acc, s) => acc + s, 0);
    return { dummyVids, durations, totalSec };
  }

  function expandPromptBraces(rawPrompt, maxVariants = 12) {
    const text = String(rawPrompt || '');
    const m = text.match(/\{([^{}|]+\|[^{}]+)\}/);
    if (!m) return [text];
    const choices = m[1].split('|').map(s => s.trim()).filter(Boolean);
    if (choices.length <= 1) return [text];
    const results = [];
    for (const choice of choices) {
      const next = text.slice(0, m.index) + choice + text.slice(m.index + m[0].length);
      for (const expanded of expandPromptBraces(next, maxVariants)) {
        results.push(expanded);
        if (results.length >= maxVariants) return results;
      }
    }
    return results;
  }

  function getPlannedBatchCount(model = state.selectedModel) {
    const props = model?.schema?.properties || {};
    const promptActive = Boolean('prompt' in props && !props.prompt?.['x-hidden']);
    const braceCount = promptActive ? expandPromptBraces(el.promptInput?.value || '', 12).length : 1;
    const seedRepeats = Math.max(1, Math.min(4, parseInt(el.batchSeedsSelect?.value || '1', 10) || 1));
    return Math.min(12, Math.max(1, braceCount * seedRepeats));
  }

  function buildPricingParams(model, overrides = {}) {
    const props = model?.schema?.properties || {};
    const reqList = model?.schema?.required || [];
    const resKey = getResolutionSchemaKey(props) || 'resolution';
    const resProp = props[resKey];

    const resVal = overrides.resolution ?? ((resProp && el.resolutionSelect?.value)
      ? el.resolutionSelect.value
      : (resProp?.default || '720p'));
    const hiddenDurDefault = !('duration' in props) || (props.duration?.['x-hidden'] && props.duration?.default === undefined)
      ? 0
      : (props.duration?.default ?? 5);
    const durVal = overrides.duration ?? (('duration' in props && !props.duration['x-hidden'] && el.durationSelect?.value !== undefined && el.durationSelect?.value !== '')
      ? Number(el.durationSelect.value)
      : hiddenDurDefault);
    const sizeVal = overrides.size ?? (('size' in props && !props.size['x-hidden'] && el.sizeSelect?.value)
      ? el.sizeSelect.value
      : (props.size?.default || '1024*1024'));
    const rawQual = ('quality' in props && !props.quality['x-hidden'] && el.qualitySelect?.value)
      ? el.qualitySelect.value
      : (props.quality?.default ?? 'medium');
    const qualVal = overrides.quality ?? (props.quality?.type === 'integer'
      ? parseInt(rawQual, 10)
      : (props.quality?.type === 'number' ? parseFloat(rawQual) : rawQual));
    const numImagesVal = overrides.num_images ?? (('num_images' in props && !props.num_images['x-hidden'] && el.numImagesSelect?.value)
      ? parseInt(el.numImagesSelect.value, 10)
      : (props.num_images?.default ?? 1));
    const fmtVal = overrides.output_format ?? (('output_format' in props && !props.output_format['x-hidden'] && el.outputFormatSelect?.value)
      ? el.outputFormatSelect.value
      : (props.output_format?.default || 'png'));

    const genAudioVal = readAudioParamValue(props, 'generate_audio');
    const soundVal = readAudioParamValue(props, 'sound');
    const saveAudioVal = readAudioParamValue(props, 'save_audio');
    const keepAudioVal = readAudioParamValue(props, 'keep_audio');
    const keepOrigSoundVal = readAudioParamValue(props, 'keep_original_sound');

    const singleImgKey = getSingleImageSchemaKey(props);
    const hasSingleAttached = Boolean(state.sourceImage || el.imageUrlInput?.value.trim());
    const hasSingleSlotValue = Boolean(singleImgKey && (hasSingleAttached || reqList.includes(singleImgKey) || model?.isImageToVideo));
    const imgCount = getPlannedInputImageCount(model);
    const dummyImgs = buildDummyImageArray(imgCount);
    const refImgs = ('reference_images' in props) ? dummyImgs : [];
    const maskVal = ('mask_image' in props && (state.hasDrawnMask || reqList.includes('mask_image'))) ? 'mask.png' : '';
    const refVidMeta = getPlannedRefVideoMeta();
    const refVidKey = getRefVideosSchemaKey(props, model);
    const refAudCount = Array.isArray(state.refAudios) ? state.refAudios.length : 0;
    const dummyAuds = Array.from({ length: refAudCount }, (_, i) => `aud${i + 1}`);
    const hasSourceVidAttached = Boolean(state.sourceVideo || el.videoUrlInput?.value.trim());

    return {
      resKey,
      resProp,
      imgCount,
      refVidMeta,
      refAudCount,
      hasSourceVidAttached,
      params: {
        resolution: resVal,
        target_resolution: resVal,
        duration: durVal,
        video_duration: overrides.video_duration ?? (state.sourceVideoDuration ?? (durVal || 5)),
        size: sizeVal,
        quality: qualVal,
        num_images: numImagesVal,
        max_images: props.max_images?.default,
        enable_web_search: Boolean(props.enable_web_search?.default ?? false),
        enable_image_search: Boolean(props.enable_image_search?.default ?? false),
        output_format: fmtVal,
        generate_audio: genAudioVal,
        sound: soundVal,
        save_audio: saveAudioVal,
        keep_audio: keepAudioVal,
        keep_original_sound: keepOrigSoundVal,
        image: hasSingleSlotValue ? 'img1' : '',
        images: dummyImgs,
        reference_images: refImgs,
        video: ('video' in props) ? (hasSourceVidAttached || reqList.includes('video') ? 'vid1' : '') : '',
        videos: refVidKey === 'videos' ? refVidMeta.dummyVids : [],
        ref_videos: refVidKey === 'ref_videos' ? refVidMeta.dummyVids : [],
        reference_videos: (!refVidKey || refVidKey === 'reference_videos') ? refVidMeta.dummyVids : [],
        reference_files: refVidKey === 'reference_files' ? [...dummyImgs, ...refVidMeta.dummyVids] : [],
        reference_video_durations: refVidMeta.durations,
        reference_audios: dummyAuds,
        audios: dummyAuds,
        mask_image: maskVal,
        ...overrides
      }
    };
  }

  // Price and Discount Calculation Helper for current active form state
  function getModelPricing(model) {
    if (!model) {
      return {
        basePrice: 0, finalPrice: 0, batchCount: 1, batchTotalPrice: 0,
        hasDiscount: false, percentOff: 0, breakdownText: ''
      };
    }
    const props = model.schema?.properties || {};
    const built = buildPricingParams(model);
    const { params, resProp, imgCount, refVidMeta, refAudCount } = built;

    const calc = calculateModelCost(model, params);
    const preUpscaleExtra = (el.preUpscaleCheckbox?.checked && el.preUpscaleLabel?.style.display !== 'none')
      ? getPreUpscaleUnitCost()
      : 0;
    const totalBasePrice = parseFloat((calc.basePrice + preUpscaleExtra).toFixed(4));
    const totalFinalPrice = parseFloat((calc.finalPrice + preUpscaleExtra).toFixed(4));
    const batchCount = getPlannedBatchCount(model);
    const batchTotalPrice = parseFloat((totalFinalPrice * batchCount).toFixed(4));

    // Explicit counted assets summary for R2V / Video-Edit / Multi-Image confidence
    const countedAssets = [];
    if (('reference_images' in props || 'images' in props || 'reference_files' in props) && imgCount > 0) {
      countedAssets.push(`${imgCount} img`);
    }
    if (refVidMeta.dummyVids.length > 0) {
      countedAssets.push(`${refVidMeta.dummyVids.length} ref vid (${refVidMeta.totalSec}s)`);
    }
    if (refAudCount > 0) {
      countedAssets.push(`${refAudCount} audio`);
    }
    const assetsNote = countedAssets.length > 0 ? ` • Inputs: ${countedAssets.join(' + ')}` : '';
    const batchNote = batchCount > 1 ? ` • Batch: ×${batchCount} = $${batchTotalPrice}` : '';

    // Build transparent formula breakdown text
    let breakdownText = '';
    const imgCountNote = params.num_images > 1 ? ` × ${params.num_images} images` : '';
    const preUpNote = preUpscaleExtra > 0 ? ` + Pre-Upscale ($${preUpscaleExtra.toFixed(4)})` : '';
    if (calc.isPerSecond && params.duration > 0) {
      const perSecBase = parseFloat((calc.basePrice / params.duration).toFixed(4));
      const perSecFinal = parseFloat((calc.finalPrice / params.duration).toFixed(4));
      const resLabel = resProp ? ` @ ${params.resolution}` : '';
      if (calc.hasDiscount) {
        breakdownText = `Formula: $${perSecBase}/s${resLabel} × ${params.duration}s = $${calc.basePrice} → $${calc.finalPrice} (${calc.percentOff}% OFF • $${perSecFinal}/s)${assetsNote}${preUpNote}${batchNote}`;
      } else {
        breakdownText = `Formula: $${perSecFinal}/s${resLabel} × ${params.duration}s = $${calc.finalPrice} total${assetsNote}${preUpNote}${batchNote}`;
      }
    } else if ('duration' in props && (model.isReferenceToVideo || model.isImageToVideo || model.isTextToVideoOrEdit)) {
      breakdownText = `Clip tier (${params.duration}s): $${calc.finalPrice} total${calc.hasDiscount ? ` (${calc.percentOff}% OFF from $${calc.basePrice})` : ''}${assetsNote}${preUpNote}${batchNote}`;
    } else if ('video' in props && (model.isTextToVideoOrEdit || (model.price_inputs || []).includes('video'))) {
      const srcSec = state.sourceVideoDuration ?? 5;
      const srcSuffix = state.sourceVideoDuration ? 's probed' : 's est.';
      const resLabel = resProp ? ` @ ${params.resolution}` : '';
      breakdownText = `Video clip (${srcSec}${srcSuffix}${resLabel}): $${calc.finalPrice}${calc.hasDiscount ? ` (${calc.percentOff}% OFF from $${calc.basePrice})` : ''}${assetsNote}${preUpNote}${batchNote}`;
    } else if ((model.price_inputs || []).includes('images') || (model.price_inputs || []).includes('reference_images')) {
      const resLabel = resProp ? ` (${params.resolution})` : '';
      const maskNote = params.mask_image ? ' + mask' : '';
      breakdownText = `Formula: Output${resLabel} + ${Math.max(1, imgCount)} input image${imgCount > 1 ? 's' : ''}${maskNote}${imgCountNote} = $${calc.finalPrice}${calc.hasDiscount ? ` (${calc.percentOff}% OFF from $${calc.basePrice})` : ''}${preUpNote}${batchNote}`;
    } else if (resProp) {
      breakdownText = `Selected tier: ${params.resolution}${imgCountNote} → $${calc.finalPrice} per run${calc.hasDiscount ? ` (${calc.percentOff}% OFF from $${calc.basePrice})` : ''}${assetsNote}${preUpNote}${batchNote}`;
    } else {
      breakdownText = `Flat rate${imgCountNote}: $${calc.finalPrice} per run${calc.hasDiscount ? ` (${calc.percentOff}% OFF)` : ''}${assetsNote}${preUpNote}${batchNote}`;
    }

    return {
      ...calc,
      basePrice: totalBasePrice,
      finalPrice: totalFinalPrice,
      batchCount,
      batchTotalPrice,
      preUpscaleExtra,
      resVal: params.resolution,
      durVal: params.duration,
      numImagesVal: params.num_images,
      qualVal: params.quality,
      fmtVal: params.output_format,
      breakdownText
    };
  }

  // Update option labels inside Resolution, Duration, Size, Quality, Num Images, and Format dropdowns with live dollar costs
  function refreshParameterOptionPrices(model) {
    if (!model) return;
    const props = model.schema?.properties || {};
    const { resProp, params: baseParams } = buildPricingParams(model);

    if (resProp && el.resolutionSelect) {
      Array.from(el.resolutionSelect.options).forEach(opt => {
        const v = opt.value;
        const vLower = v.toLowerCase();
        let tierDesc = 'Standard';
        if (vLower === '360p') tierDesc = 'Ultra Economy';
        else if (vLower === '480p' || vLower === '540p') tierDesc = 'Economy • Saves Credits';
        else if (vLower === '720p' || vLower === '768p') tierDesc = 'Standard HD';
        else if (vLower === '1080p') tierDesc = 'Full HD';
        else if (vLower === '1k') tierDesc = 'Standard';
        else if (vLower === '1.5k') tierDesc = 'Balanced';
        else if (vLower === '2k') tierDesc = 'High-Res';
        else if (vLower === '3k') tierDesc = 'Ultra 3K';
        else if (vLower === '4k') tierDesc = 'Extreme 4K';
        else if (vLower === '8k') tierDesc = 'Master 8K';

        const c = calculateModelCost(model, { ...baseParams, resolution: v, target_resolution: v });
        const warn = (state.balance > 0 && c.finalPrice > state.balance) ? ' ⚠️ > Balance' : '';
        opt.textContent = `${v} (${tierDesc}) — $${c.finalPrice}${warn}`;
      });
    }

    if ('duration' in props && !props.duration['x-hidden'] && el.durationSelect) {
      Array.from(el.durationSelect.options).forEach(opt => {
        const d = Number(opt.value);
        const c = calculateModelCost(model, { ...baseParams, duration: d, video_duration: state.sourceVideoDuration ?? d });
        const fitTag = state.balance > 0
          ? (c.finalPrice <= state.balance ? ' ✓ Fits Balance' : ' ⚠️ Exceeds Balance')
          : '';
        opt.textContent = `${d} seconds — $${c.finalPrice}${fitTag}`;
      });
    }

    if ('quality' in props && !props.quality['x-hidden'] && el.qualitySelect) {
      Array.from(el.qualitySelect.options).forEach(opt => {
        const q = opt.value;
        const qParam = props.quality.type === 'integer' ? parseInt(q, 10) : q;
        const c = calculateModelCost(model, { ...baseParams, quality: qParam });
        const warn = (state.balance > 0 && c.finalPrice > state.balance) ? ' ⚠️ > Balance' : '';
        opt.textContent = `${String(q).toUpperCase()} — $${c.finalPrice}${warn}`;
      });
    }

    if ('num_images' in props && !props.num_images['x-hidden'] && el.numImagesSelect) {
      Array.from(el.numImagesSelect.options).forEach(opt => {
        const n = parseInt(opt.value, 10);
        const c = calculateModelCost(model, { ...baseParams, num_images: n });
        const warn = (state.balance > 0 && c.finalPrice > state.balance) ? ' ⚠️ > Balance' : '';
        opt.textContent = `${n} image${n > 1 ? 's' : ''} — $${c.finalPrice}${warn}`;
      });
    }

    if ('output_format' in props && !props.output_format['x-hidden'] && el.outputFormatSelect && (model.formula || '').includes('output_format')) {
      Array.from(el.outputFormatSelect.options).forEach(opt => {
        const fmt = opt.value;
        const c = calculateModelCost(model, { ...baseParams, output_format: fmt });
        opt.textContent = `${fmt.toUpperCase()} — $${c.finalPrice}`;
      });
    }

    if ('size' in props && !props.size['x-hidden'] && el.sizeSelect && (model.formula || '').includes('size')) {
      Array.from(el.sizeSelect.options).forEach(opt => {
        const s = opt.value;
        const c = calculateModelCost(model, { ...baseParams, size: s });
        opt.textContent = `${s} — $${c.finalPrice}`;
      });
    }
  }

  function isModelSpicy(m) {
    if (!m) return false;
    if (m.isSpicy) return true;
    const txt = `${m.model_id || ''} ${m.name || ''} ${m.description || ''}`.toLowerCase();
    return txt.includes('spicy') || txt.includes('nsfw') || txt.includes('uncensored');
  }

  // Filter & Render Autocomplete Dropdown List
  function filterAndRenderAutocomplete() {
    const rawVal = el.modelAutocompleteInput.value.trim();
    const isAutoSelectedDisplay = !state.comboboxUserTyped && state.selectedModel && rawVal === state.selectedModel.model_id;
    const query = isAutoSelectedDisplay ? '' : rawVal.toLowerCase();
    const tokens = query.split(/\s+/).filter(Boolean);
    const filterMode = state.comboboxFilter; // 'tab' (default), 'spicy', 'affordable', 'all', 'cheap'
    const category = state.currentCategory;

    // Filter models
    const matches = state.models.filter(m => {
      const fullText = `${m.model_id} ${m.name || ''} ${m.description || ''} ${m.type || ''}`.toLowerCase();

      // Check tokens
      if (tokens.length > 0) {
        const matchesAllTokens = tokens.every(tok => fullText.includes(tok));
        if (!matchesAllTokens) return false;
      }

      // Filter by respective use / tab
      if (filterMode === 'tab') {
        if (!isModelInCategory(m, category)) return false;
      } else if (filterMode === 'spicy') {
        if (!isModelSpicy(m)) return false;
      } else if (filterMode === 'affordable') {
        if (!isModelInCategory(m, category)) return false;
        const catP = getCatalogItemPricing(m);
        if (state.balance > 0 && catP.minRunCost > state.balance) return false;
      } else if (filterMode === 'cheap') {
        if (!isModelInCategory(m, category)) return false;
        const catP = getCatalogItemPricing(m);
        if (catP.minRunCost > 0.05) return false;
      }

      return true;
    });

    // Sort: Pinned top-picks first (by pinnedRank), then query match, then minimum run cost ascending
    matches.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      if (a.isPinned && b.isPinned && (a.pinnedRank ?? 9999) !== (b.pinnedRank ?? 9999)) {
        return (a.pinnedRank ?? 9999) - (b.pinnedRank ?? 9999);
      }

      if (query) {
        const aIdHas = a.model_id.toLowerCase().includes(query) || (a.name && a.name.toLowerCase().includes(query));
        const bIdHas = b.model_id.toLowerCase().includes(query) || (b.name && b.name.toLowerCase().includes(query));
        if (aIdHas && !bIdHas) return -1;
        if (!aIdHas && bIdHas) return 1;
      }
      return (a.effective_price ?? a.base_price ?? 0) - (b.effective_price ?? b.base_price ?? 0);
    });

    state.filteredModels = matches;
    el.modelsCountBadge.textContent = `${matches.length} models`;

    // Render Dropdown List (limit to top 80)
    const displayList = matches.slice(0, 80);
    el.comboboxList.innerHTML = '';

    if (displayList.length === 0) {
      el.comboboxList.innerHTML = `<div class="combobox-empty">No models found matching "${escapeHtml(query)}". Try switching filter chips above.</div>`;
      state.comboboxActiveIndex = -1;
      return;
    }

    displayList.forEach((m, idx) => {
      const item = document.createElement('div');
      item.className = 'combobox-item';
      if (m.isPinned) item.classList.add('pinned');
      if (idx === state.comboboxActiveIndex) item.classList.add('active');

      const catP = getCatalogItemPricing(m);
      const unitSuffix = catP.isPerSecond ? '/s' : '';
      let priceMarkup = '';
      if (catP.hasDiscount) {
        priceMarkup = `
          <div class="price-pill-wrapper">
            <span class="price-strikethrough">$${catP.rawBaseRate}${unitSuffix}</span>
            <span class="combobox-item-price">$${catP.finalBaseRate}${unitSuffix}</span>
            <span class="badge-discount">${catP.percentOff}% OFF</span>
          </div>
        `;
      } else {
        priceMarkup = `<span class="combobox-item-price">$${catP.finalBaseRate}${unitSuffix}</span>`;
      }

      const cleanTitle = m.name || m.model_id;
      const highlightedTitle = highlightMatches(cleanTitle, query);
      const highlightedId = highlightMatches(m.model_id, query);
      const categoryLabel = m.isReferenceToVideo ? 'Ref to Video' :
                            m.isImageToVideo ? 'Image to Video' :
                            m.isTextToVideoOrEdit ? 'Video & Edit' :
                            m.isImageEdit ? 'Image Edit' :
                            m.isImageGen ? 'Text to Image' : 'Utility';

      let minRunBadge = '';
      if (catP.isPerSecond) {
        const fits = state.balance <= 0 || catP.minRunCost <= state.balance;
        const color = fits ? 'color: #6ee7b7;' : 'color: #fca5a5;';
        minRunBadge = `<span style="${color} font-size: 0.71rem; font-family: var(--font-mono);">Min (${catP.minRes} • ${catP.minDur}s): $${catP.minRunCost}</span>`;
      }

      item.innerHTML = `
        <div class="combobox-item-top">
          <span class="combobox-item-id">
            ${highlightedTitle}
            ${m.isPinned ? '<span class="badge-pinned">⭐ Top Pick</span>' : ''}
            ${(!m.isPinned && isModelSpicy(m)) ? '<span class="badge-pinned">🌶️ Spicy</span>' : ''}
          </span>
          ${priceMarkup}
        </div>
        <div class="combobox-item-bottom">
          <span class="combobox-item-type">${categoryLabel}</span>
          ${minRunBadge || `<span style="opacity: 0.6; font-size: 0.72rem; font-family: var(--font-mono);">${highlightedId}</span>`}
        </div>
      `;

      item.addEventListener('click', (e) => {
        e.stopPropagation();
        selectModel(m.model_id);
        closeCombobox();
      });

      el.comboboxList.appendChild(item);
    });

    el.comboboxClearBtn.style.display = query ? 'block' : 'none';
  }

  function openCombobox() {
    el.comboboxDropdown.style.display = 'flex';
    filterAndRenderAutocomplete();
  }

  function closeCombobox() {
    el.comboboxDropdown.style.display = 'none';
    state.comboboxActiveIndex = -1;
  }

  // Model Selection Handler
  async function selectModel(modelId, autoSyncTab = true) {
    const model = state.models.find(m => m.model_id === modelId);
    if (!model) return;

    state.selectedModel = model;
    state.comboboxUserTyped = false;
    el.modelAutocompleteInput.value = model.model_id;
    el.comboboxClearBtn.style.display = 'block';

    // Auto-sync category tab if needed
    if (autoSyncTab && model.category && model.category !== state.currentCategory) {
      let targetCat = model.category;
      if (model.isReferenceToVideo) targetCat = 'ref-to-video';
      else if (model.isImageToVideo) targetCat = 'image-to-video';
      else if (model.isTextToVideoOrEdit) targetCat = 'video-gen';
      else if (model.isImageEdit) targetCat = 'image-edit';
      else if (model.isImageGen) targetCat = 'image-gen';
      else if (model.isUtility) targetCat = 'utility';

      if (targetCat !== state.currentCategory) {
        state.currentCategory = targetCat;
        el.modeBtns.forEach(btn => {
          btn.classList.toggle('active', btn.dataset.category === state.currentCategory);
        });
        updatePlaceholderForCategory();
      }
    }

    adaptUIForModel(model);
    updateModelInfo(model);

    // Fetch or verify exact WaveSpeed RSC formula on-demand if not yet verified in the last 30 mins
    const now = Date.now();
    const isFresh = model.has_formula && model.fetched_at && (now - model.fetched_at < 1800000);
    if (!isFresh) {
      try {
        const res = await fetch(`/api/model-pricing?id=${encodeURIComponent(model.model_id)}`);
        const json = await res.json();
        if (json.data) {
          if (!json.data.inherited_from || !model.base_price_micro) {
            model.base_price_micro = json.data.base_price_micro || model.base_price_micro;
            if (model.base_price_micro) model.base_price = model.base_price_micro / 1e6;
          }
          model.discount_rate = json.data.discount_rate ?? 100;
          model.discount_percent = Math.max(0, (100 - model.discount_rate) / 100);
          model.formula = json.data.formula || '';
          model.price_inputs = json.data.price_inputs || [];
          model.has_formula = true;
          model.fetched_at = json.data.fetched_at || now;
          if (state.selectedModel && state.selectedModel.model_id === model.model_id) {
            updateModelInfo(model);
          }
        }
      } catch (e) {
        console.warn('Live model pricing fetch skipped:', e);
      }
    }
  }

  // Update Model Details Box & Live Affordability Guard
  function updateModelInfo(model) {
    if (!model) {
      el.infoModelTitle.textContent = 'None';
      el.infoModelPrice.textContent = '$0.00';
      if (el.infoPriceBreakdown) el.infoPriceBreakdown.style.display = 'none';
      el.infoModelDesc.textContent = 'No model selected';
      el.infoModelTags.innerHTML = '';
      el.btnPriceBadge.textContent = '• $0.00';
      return;
    }

    // Update live option labels in dropdowns and audio cost hint
    refreshParameterOptionPrices(model);
    updateAudioControlHint(model, getAudioSchemaKey(model.schema?.properties || {}), model.schema?.properties || {});

    const cleanTitle = model.name || model.model_id;
    el.infoModelTitle.innerHTML = `${escapeHtml(cleanTitle)} ${model.isPinned ? '<span class="badge-pinned">⭐ Top Pick</span>' : ''}`;
    
    const pricing = getModelPricing(model);
    const totalPlannedCost = pricing.batchCount > 1 ? pricing.batchTotalPrice : pricing.finalPrice;
    const batchSuffix = pricing.batchCount > 1 ? ` ×${pricing.batchCount}` : '';
    if (pricing.hasDiscount) {
      el.infoModelPrice.innerHTML = `
        <div class="price-pill-wrapper">
          <span class="price-strikethrough">$${pricing.basePrice}</span>
          <span class="price-pill">$${pricing.finalPrice}</span>
          <span class="badge-discount">${pricing.percentOff}% OFF</span>
        </div>
      `;
      el.btnPriceBadge.textContent = pricing.batchCount > 1
        ? `• $${totalPlannedCost} (${pricing.batchCount}× $${pricing.finalPrice})`
        : `• $${pricing.finalPrice} (${pricing.percentOff}% OFF)`;
    } else {
      el.infoModelPrice.innerHTML = `<span class="price-pill">$${pricing.finalPrice} / run${batchSuffix}</span>`;
      el.btnPriceBadge.textContent = pricing.batchCount > 1
        ? `• $${totalPlannedCost} (${pricing.batchCount}× $${pricing.finalPrice})`
        : `• $${pricing.finalPrice}`;
    }

    if (el.batchMatrixHint) {
      if (pricing.batchCount > 1) {
        const bCount = ('prompt' in (model.schema?.properties || {})) ? expandPromptBraces(el.promptInput?.value || '', 12).length : 1;
        const sCount = Math.max(1, Math.min(4, parseInt(el.batchSeedsSelect?.value || '1', 10) || 1));
        el.batchMatrixHint.style.display = 'block';
        el.batchMatrixHint.textContent = `Batch matrix: ${bCount} prompt variant${bCount > 1 ? 's' : ''} × ${sCount} seed${sCount > 1 ? 's' : ''} = ${pricing.batchCount} concurrent runs ($${totalPlannedCost} total)`;
      } else {
        el.batchMatrixHint.style.display = 'none';
      }
    }

    const pendingSpend = getPendingJobsSpend();
    const afterAllPendingAndNext = Math.max(0, state.balance - pendingSpend - totalPlannedCost);
    const balanceProjectionText = (state.balance > 0)
      ? ` • After run${pendingSpend > 0 ? ' (+active)' : ''}: $${afterAllPendingAndNext.toFixed(4)} (-$${Number(totalPlannedCost).toFixed(4)})`
      : '';
    if (el.infoPriceBreakdown) {
      if (pricing.breakdownText || balanceProjectionText) {
        el.infoPriceBreakdown.style.display = 'block';
        el.infoPriceBreakdown.textContent = `${pricing.breakdownText || `Run Cost: $${totalPlannedCost}`}${balanceProjectionText}`;
      } else {
        el.infoPriceBreakdown.style.display = 'none';
      }
    }

    // Live Balance & Affordability Banner (with exact post-run reduction, batch multiplier & pending concurrent spend)
    if (el.affordabilityBanner && state.balance > 0) {
      el.affordabilityBanner.style.display = 'block';
      const costNum = Number(totalPlannedCost) || 0;
      const pctOfBal = state.balance > 0 ? ((costNum / state.balance) * 100).toFixed(1) : '0.0';
      const afterSingle = state.balance - costNum;
      const afterAll = afterSingle - pendingSpend;
      const pendingNote = pendingSpend > 0
        ? ` | In-flight jobs: <strong>-$${pendingSpend.toFixed(4)}</strong> (after all: <strong>$${Math.max(0, afterAll).toFixed(4)}</strong>)`
        : '';

      if (costNum > state.balance || (pendingSpend > 0 && afterAll < 0)) {
        const diff = (costNum + pendingSpend - state.balance).toFixed(4);
        el.affordabilityBanner.className = 'affordability-banner insufficient';
        el.affordabilityBanner.innerHTML = `⚠️ <strong>Exceeds Balance:</strong> Reduces balance by <strong>-$${costNum.toFixed(4)}</strong> (${pctOfBal}%). Total with active runs short by <strong>$${diff}</strong> (current: $${state.balance.toFixed(4)}).`;
        el.generateBtn.classList.add('insufficient-warning');
      } else {
        const rem = Math.max(0, afterAll).toFixed(4);
        const unitCost = Number(pricing.finalPrice) || 0;
        const maxRuns = unitCost > 0 ? Math.floor(Math.max(0, state.balance - pendingSpend) / unitCost) : 0;
        const runsNote = maxRuns > 0 ? ` • <strong>~${maxRuns} runs</strong> left` : '';
        el.affordabilityBanner.className = 'affordability-banner affordable';
        el.affordabilityBanner.innerHTML = `✓ <strong>Cost Impact: -$${costNum.toFixed(4)}</strong>${batchSuffix} (-${pctOfBal}%) • Remaining: <strong>$${state.balance.toFixed(4)} → $${rem}</strong>${pendingNote}${runsNote}`;
        el.generateBtn.classList.remove('insufficient-warning');
      }
    } else if (el.affordabilityBanner) {
      el.affordabilityBanner.style.display = 'none';
      el.generateBtn.classList.remove('insufficient-warning');
    }

    updateSidebarBalanceProjection(model, pricing);
    evaluatePreFlightSafety();

    el.infoModelDesc.textContent = model.description || 'No description provided by model publisher.';
    updateUseCaseAdvice(model);

    // Tags
    el.infoModelTags.innerHTML = '';
    const catLabel = model.isReferenceToVideo ? 'Reference to Video' :
                     model.isImageToVideo ? 'Image to Video' :
                     model.isTextToVideoOrEdit ? 'Video & Edit' :
                     model.isImageEdit ? 'Image Edit' :
                     model.isImageGen ? 'Text to Image' : 'Utility';
    const tags = [catLabel, model.type, model.model_id].filter(Boolean);
    tags.forEach(t => {
      const sp = document.createElement('span');
      sp.className = 'tag-badge';
      sp.textContent = t;
      el.infoModelTags.appendChild(sp);
    });
  }

  // Economy Auto-Default Helpers (favor cheapest non-duration parameters on Video & Image Edit)
  function isEconomyTargetModel(model) {
    return Boolean(
      state.economyDefaultsEnabled &&
      model &&
      (model.isReferenceToVideo || model.isImageToVideo || model.isImageEdit || model.isTextToVideoOrEdit)
    );
  }

  function getResolutionRank(res) {
    const order = ['360p', '480p', '540p', '720p', '768p', '1080p', '1k', '1.5k', '2k', '3k', '4k'];
    const idx = order.indexOf(String(res || '').toLowerCase());
    return idx === -1 ? 999 : idx;
  }

  function getSizePixelCount(sizeStr) {
    const parts = String(sizeStr || '').toLowerCase().split(/[*x×]/).map(n => parseInt(n, 10));
    if (parts.length >= 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])) {
      return parts[0] * parts[1];
    }
    return Number.MAX_SAFE_INTEGER;
  }

  function getQualityRank(q) {
    const order = ['very_low', 'low', 'fast', 'standard', 'medium', 'high', 'ultra'];
    const s = String(q ?? '').toLowerCase();
    const num = Number(q);
    if (!Number.isNaN(num) && s !== '') return num;
    const idx = order.indexOf(s);
    return idx === -1 ? 999 : idx;
  }

  function pickCheapestEnumOption(model, fieldName, enums, tieBreakRankFn, baseParams = {}) {
    if (!Array.isArray(enums) || enums.length === 0) return undefined;
    let bestVal = enums[0];
    let bestCost = Infinity;
    let bestRank = Infinity;
    for (const candidate of enums) {
      const c = calculateModelCost(model, { ...baseParams, [fieldName]: candidate });
      const price = typeof c?.finalPrice === 'number' ? c.finalPrice : Infinity;
      const rank = tieBreakRankFn ? tieBreakRankFn(candidate) : 0;
      if (price < bestCost - 1e-9 || (Math.abs(price - bestCost) <= 1e-9 && rank < bestRank)) {
        bestVal = candidate;
        bestCost = price;
        bestRank = rank;
      }
    }
    return bestVal;
  }

  // Adapt UI Controls according to Model Schema
  function adaptUIForModel(model) {
    const props = model.schema?.properties || {};
    const useEconomyDefaults = isEconomyTargetModel(model);
    if (el.economyModeHint) {
      el.economyModeHint.style.display = useEconomyDefaults ? 'block' : 'none';
    }

    const hasVideoAndImageRefs = Boolean(
      'video' in props &&
      (('reference_images' in props && !props.reference_images['x-hidden']) ||
       ('images' in props && !props.images['x-hidden']))
    );

    // 1. Prompt & Negative Prompt
    if ('prompt' in props && !props.prompt['x-hidden']) {
      el.promptGroup.style.display = 'flex';
      if (isR2VModel(model)) {
        el.promptInput.placeholder = 'Describe the video. Refer to inputs as Image 1, Video 1, or Audio 1...';
      } else if (hasVideoAndImageRefs) {
        el.promptInput.placeholder = 'Describe what to edit in the clip (you can refer to attached references as Image 1, Image 2...)';
      } else {
        el.promptInput.placeholder = 'Enter detailed prompt...';
      }
    } else {
      el.promptGroup.style.display = 'none';
    }
    if (el.negativePromptGroup) {
      el.negativePromptGroup.style.display = ('negative_prompt' in props && !props.negative_prompt['x-hidden']) ? 'flex' : 'none';
    }
    if (el.r2vRefChips) {
      el.r2vRefChips.style.display = (isR2VModel(model) || hasVideoAndImageRefs) ? 'contents' : 'none';
    }

    // 2. Image Inputs (single Source Image when schema takes `image` / `face_image` or is I2V; pure multi-image arrays use #multiImageGroup directly)
    const multiProp = ('images' in props && !props.images['x-hidden'])
      ? props.images
      : (('reference_images' in props && !props.reference_images['x-hidden'])
        ? props.reference_images
        : ((isR2VModel(model) && 'reference_files' in props && !props.reference_files['x-hidden']) ? props.reference_files : null));
    const singleImgKey = getSingleImageSchemaKey(props);
    const hasSingleImage = Boolean(singleImgKey || model.isImageToVideo);
    el.imageInputGroup.style.display = hasSingleImage ? 'flex' : 'none';
    if (hasSingleImage) {
      const lbl = el.imageInputGroup.querySelector('.input-header label');
      const sub = el.imageInputGroup.querySelector('.input-header .subtext');
      const reqList = model.schema?.required || [];
      const isReq = reqList.includes('image') || reqList.includes('face_image') || reqList.includes('images') || reqList.includes('reference_images');
      const reqStar = isReq ? ' <span class="required">*</span>' : '';
      if (model.isImageToVideo) {
        if (lbl) lbl.innerHTML = `Image to Animate${reqStar}`;
        if (sub) sub.textContent = 'Upload still image, paste URL, or extract a frame from the Timeline below';
      } else if (singleImgKey === 'face_image') {
        if (lbl) lbl.innerHTML = `Reference Face Image${reqStar}`;
        if (sub) sub.textContent = 'Upload, drag & drop, or paste target image URL';
      } else {
        if (lbl) lbl.innerHTML = `Source Image${reqStar}`;
        if (sub) sub.textContent = 'Upload, drag & drop, or paste image URL';
      }
    }

    // 2b. Optional End Frame (Last Image) for interpolation/I2V models
    const hasLastImage = 'last_image' in props && !props.last_image['x-hidden'];
    if (el.lastImageGroup) {
      el.lastImageGroup.style.display = hasLastImage ? 'flex' : 'none';
      if (hasLastImage) {
        const lastLbl = el.lastImageGroup.querySelector('.input-header label');
        const lastReq = (model.schema?.required || []).includes('last_image');
        if (lastLbl) lastLbl.innerHTML = `Optional End Frame (Last Image)${lastReq ? ' <span class="required">*</span>' : ''}`;
      }
    }

    // 2c. Multi-Image Reference Slots (Wan 3.0 R2V, Seedance 2.5, Kling 4.0, MiniMax H3)
    if (el.multiImageGroup) {
      el.multiImageGroup.style.display = multiProp ? 'flex' : 'none';
      if (multiProp) {
        const maxRefs = Math.min(30, Math.max(2, Number(multiProp.maxItems || props.max_images?.maximum || 10)));
        const mLbl = el.multiImageGroup.querySelector('.input-header label');
        if (mLbl) {
          mLbl.textContent = hasSingleImage
            ? `Additional Reference Images (Up to ${maxRefs - 1} extra)`
            : `Reference Images (Up to ${maxRefs})`;
        }
        renderExtraImagesGrid();
      }
    }

    // 2d. Reference Videos (R2V: reference_videos / videos / ref_videos / reference_files)
    const refVidKey = getRefVideosSchemaKey(props, model);
    if (el.refVideosGroup) {
      el.refVideosGroup.style.display = refVidKey ? 'flex' : 'none';
      if (refVidKey) {
        const vidProp = props[refVidKey] || {};
        const maxVids = Math.min(10, Math.max(1, Number(vidProp.maxItems || 5)));
        if (el.refVideosLabel) {
          el.refVideosLabel.textContent = `Reference Videos (Up to ${maxVids})`;
        }
        if (el.useActiveRefVideoBtn) {
          const hasActiveVid = Boolean(state.activeOutputItem?.isVideo || state.activeOutputItem?.is_video);
          el.useActiveRefVideoBtn.style.display = hasActiveVid ? 'inline-flex' : 'none';
        }
        renderRefVideosList();
      }
    }

    // 2e. Reference Audios (R2V / Video Edit: reference_audios / audios / audio)
    const refAudKey = getRefAudiosSchemaKey(props);
    if (el.refAudiosGroup) {
      el.refAudiosGroup.style.display = refAudKey ? 'flex' : 'none';
      if (refAudKey) {
        const audProp = props[refAudKey] || {};
        const isSingleAud = audProp.type === 'string';
        const maxAuds = isSingleAud ? 1 : Math.min(10, Math.max(1, Number(audProp.maxItems || 5)));
        if (el.refAudiosLabel) {
          el.refAudiosLabel.textContent = `Reference Audio${isSingleAud ? '' : `s (Up to ${maxAuds})`}`;
        }
        renderRefAudiosList();
      }
    }

    // 2f. Video Timeline & Frame Extractor + Quality Match Advisory
    if (el.videoTimelineGroup) {
      const showTimeline = Boolean(
        hasSingleImage || multiProp || refVidKey || 'video' in props ||
        model.isImageToVideo || model.isReferenceToVideo || model.isImageEdit || model.isTextToVideoOrEdit
      );
      el.videoTimelineGroup.style.display = showTimeline ? 'block' : 'none';
      if (showTimeline) {
        if (el.extractFrameLastBtn) el.extractFrameLastBtn.style.display = hasLastImage ? 'inline-flex' : 'none';
        if (el.extractFrameRefBtn) el.extractFrameRefBtn.style.display = multiProp ? 'inline-flex' : 'none';
        if (el.loadActiveToTimelineBtn) {
          const hasActiveVid = Boolean(state.activeOutputItem?.isVideo || state.activeOutputItem?.is_video);
          el.loadActiveToTimelineBtn.style.display = hasActiveVid ? 'inline-flex' : 'none';
        }
      }
    }

    // 3. Mask Canvas for Inpainting
    if ('mask_image' in props) {
      el.maskCanvasGroup.style.display = 'flex';
      clearMask();
    } else {
      el.maskCanvasGroup.style.display = 'none';
    }

    // 4. Video Input
    if ('video' in props) {
      el.videoInputGroup.style.display = 'flex';
      const vSub = el.videoInputGroup.querySelector('.input-header .subtext');
      const midLower = String(model.model_id || '').toLowerCase();
      if (vSub) {
        vSub.textContent = midLower.includes('alibaba/wan-3.')
          ? 'Upload MP4/WEBM/MOV (up to 15s on Wan 3.0; longer clips trim automatically) or paste URL'
          : 'Upload MP4/WEBM/MOV or paste video URL';
      }
    } else {
      el.videoInputGroup.style.display = 'none';
    }

    // 5. Strength Slider
    if ('strength' in props) {
      el.strengthRow.style.display = 'flex';
      const def = props.strength.default || 0.7;
      el.strengthSlider.value = def;
      el.strengthValueLabel.textContent = def;
    } else {
      el.strengthRow.style.display = 'none';
    }

    // 6. Aspect Ratio (Dynamically populated & defaulted from model schema)
    if ('aspect_ratio' in props && !props.aspect_ratio['x-hidden'] && el.ratioPills) {
      el.aspectRatioRow.style.display = 'flex';
      const enums = (Array.isArray(props.aspect_ratio.enum) && props.aspect_ratio.enum.length > 0)
        ? props.aspect_ratio.enum
        : ['1:1', '16:9', '9:16', '4:3', '3:2'];
      const ratioLabels = {
        '1:1': '1:1 Square',
        '16:9': '16:9 Wide',
        '9:16': '9:16 Portrait',
        '4:3': '4:3 Standard',
        '3:4': '3:4 Vertical',
        '3:2': '3:2 Classic',
        '2:3': '2:3 Tall',
        '21:9': '21:9 Cinema',
        '9:21': '9:21 Tall',
        'auto': 'Auto'
      };
      const prevActive = el.ratioPills.querySelector('.ratio-pill.active')?.dataset.ratio;
      const schemaRatioDef = (props.aspect_ratio.default && enums.includes(props.aspect_ratio.default))
        ? props.aspect_ratio.default
        : (prevActive && enums.includes(prevActive) ? prevActive : enums[0]);
      const defaultRatio = useEconomyDefaults
        ? pickCheapestEnumOption(
            model,
            'aspect_ratio',
            enums,
            (r) => (r === 'auto' ? -2 : (r === '1:1' ? -1 : (r === schemaRatioDef ? 0 : 1))),
            { duration: 1, resolution: '480p' }
          )
        : schemaRatioDef;

      el.ratioPills.innerHTML = '';
      enums.forEach(r => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'ratio-pill' + (r === defaultRatio ? ' active' : '');
        btn.dataset.ratio = r;
        btn.textContent = ratioLabels[r] || r;
        el.ratioPills.appendChild(btn);
      });
    } else if (el.aspectRatioRow) {
      el.aspectRatioRow.style.display = 'none';
    }

    // 7. Dynamic Output Resolution / Target Resolution (Strictly based on model schema; cheapest first in Economy mode)
    const resKey = getResolutionSchemaKey(props);
    if (resKey && el.resolutionSelect) {
      const resProp = props[resKey];
      el.resolutionCol.style.display = 'block';
      const resLabelEl = el.resolutionCol.querySelector('label[for="resolutionSelect"]');
      if (resLabelEl) {
        resLabelEl.textContent = resKey === 'target_resolution' ? 'Target Resolution' : 'Output Resolution';
      }
      el.resolutionSelect.innerHTML = '';
      const enums = (Array.isArray(resProp.enum) && resProp.enum.length > 0)
        ? [...resProp.enum]
        : (isVideoTabModel(model) ? ['480p', '720p', '1080p'] : ['1k', '2k']);
      if (resProp.default !== undefined && !enums.includes(resProp.default)) {
        enums.unshift(resProp.default);
      }
      const schemaResDef = (resProp.default !== undefined && enums.includes(resProp.default))
        ? resProp.default
        : (enums.includes('480p') ? '480p' : (enums.includes('720p') ? '720p' : (enums.includes('1k') ? '1k' : enums[0])));
      const defaultVal = useEconomyDefaults
        ? pickCheapestEnumOption(model, resKey, enums, getResolutionRank, { duration: 5, images: ['img1'] })
        : schemaResDef;

      enums.forEach(v => {
        const opt = document.createElement('option');
        opt.value = v;
        opt.textContent = v;
        if (v === defaultVal) opt.selected = true;
        el.resolutionSelect.appendChild(opt);
      });
    } else if (el.resolutionCol) {
      el.resolutionCol.style.display = 'none';
    }

    // 8. Dynamic Video Duration (Every integer duration from min to 12s, plus extended steps)
    if ('duration' in props && !props.duration['x-hidden'] && el.durationSelect) {
      el.durationRow.style.display = 'block';
      el.durationSelect.innerHTML = '';
      let durations = [];
      if (props.duration.enum && Array.isArray(props.duration.enum) && props.duration.enum.length > 0) {
        durations = [...props.duration.enum];
      } else {
        const min = props.duration.minimum ?? 3;
        const max = props.duration.maximum ?? 15;
        if (min === 0) durations.push(0);
        for (let s = Math.max(1, Math.ceil(min)); s <= Math.min(max, 12); s++) {
          if (!durations.includes(s)) durations.push(s);
        }
        [15, 20, 25, 30].forEach(ext => {
          if (ext > 12 && ext <= max && !durations.includes(ext)) durations.push(ext);
        });
        if (!durations.includes(max)) durations.push(max);
      }
      const defDur = props.duration.default !== undefined
        ? props.duration.default
        : (durations.includes(5) ? 5 : durations[0]);
      if (typeof defDur === 'number' && !durations.includes(defDur)) {
        durations.push(defDur);
        durations.sort((a, b) => a - b);
      }
      durations.forEach(d => {
        const opt = document.createElement('option');
        opt.value = d;
        opt.textContent = `${d} seconds`;
        if (d === defDur) opt.selected = true;
        el.durationSelect.appendChild(opt);
      });
    } else if (el.durationRow) {
      el.durationRow.style.display = 'none';
    }

    // 9. Dimensions / Size (Respect x-hidden and restore standard sizes when enum is absent)
    if ('size' in props && !props.size['x-hidden'] && el.sizeRow && el.sizeSelect) {
      el.sizeRow.style.display = 'block';
      el.sizeSelect.innerHTML = '';
      const sizeEnums = (Array.isArray(props.size.enum) && props.size.enum.length > 0)
        ? [...props.size.enum]
        : ['512*512', '768*768', '1024*1024', '1280*720', '720*1280'];
      if (props.size.default && !sizeEnums.includes(props.size.default)) {
        sizeEnums.unshift(props.size.default);
      }
      const schemaSizeDef = (props.size.default && sizeEnums.includes(props.size.default))
        ? props.size.default
        : (sizeEnums.includes('1024*1024') ? '1024*1024' : sizeEnums[0]);
      const defSize = useEconomyDefaults
        ? pickCheapestEnumOption(model, 'size', sizeEnums, getSizePixelCount, { images: ['img1'] })
        : schemaSizeDef;
      sizeEnums.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s;
        let note = '';
        if (s.includes('512') || s.includes('768')) note = ' (Fast Economy)';
        else if (s.includes('1024')) note = ' (Standard)';
        else if (s.includes('1536') || s.includes('2048')) note = ' (High Detail)';
        opt.textContent = `${s}${note}`;
        if (s === defSize) opt.selected = true;
        el.sizeSelect.appendChild(opt);
      });
    } else if (el.sizeRow) {
      el.sizeRow.style.display = 'none';
    }

    // 10. Quality Tier
    if ('quality' in props && !props.quality['x-hidden'] && el.qualityRow && el.qualitySelect) {
      el.qualityRow.style.display = 'block';
      el.qualitySelect.innerHTML = '';
      const isNumericQ = props.quality.type === 'integer' || props.quality.type === 'number';
      const qEnums = (Array.isArray(props.quality.enum) && props.quality.enum.length > 0)
        ? [...props.quality.enum]
        : (isNumericQ ? [props.quality.default ?? 1] : ['low', 'medium', 'high']);
      if (props.quality.default !== undefined && !qEnums.includes(props.quality.default)) {
        qEnums.unshift(props.quality.default);
      }
      const schemaQDef = (props.quality.default !== undefined && qEnums.includes(props.quality.default))
        ? props.quality.default
        : (qEnums.includes('medium') ? 'medium' : qEnums[0]);
      const qDef = useEconomyDefaults
        ? pickCheapestEnumOption(model, 'quality', qEnums, getQualityRank, { resolution: '1k', images: ['img1'] })
        : schemaQDef;
      qEnums.forEach(q => {
        const opt = document.createElement('option');
        opt.value = String(q);
        opt.textContent = String(q).toUpperCase();
        if (q === qDef) opt.selected = true;
        el.qualitySelect.appendChild(opt);
      });
    } else if (el.qualityRow) {
      el.qualityRow.style.display = 'none';
    }

    // 11. Number of Images (num_images)
    if ('num_images' in props && !props.num_images['x-hidden'] && el.numImagesRow && el.numImagesSelect) {
      el.numImagesRow.style.display = 'block';
      el.numImagesSelect.innerHTML = '';
      let counts = [];
      if (Array.isArray(props.num_images.enum) && props.num_images.enum.length > 0) {
        counts = [...props.num_images.enum];
      } else {
        const min = Math.max(1, props.num_images.minimum ?? 1);
        const max = Math.min(9, props.num_images.maximum ?? 4);
        for (let n = min; n <= max; n++) counts.push(n);
      }
      const schemaCountDef = props.num_images.default !== undefined
        ? Number(props.num_images.default)
        : counts[0];
      if (!counts.includes(schemaCountDef)) {
        counts.push(schemaCountDef);
        counts.sort((a, b) => a - b);
      }
      const defCount = useEconomyDefaults ? Math.min(...counts.map(Number)) : schemaCountDef;
      counts.forEach(n => {
        const opt = document.createElement('option');
        opt.value = String(n);
        opt.textContent = `${n} image${n > 1 ? 's' : ''}`;
        if (n === defCount) opt.selected = true;
        el.numImagesSelect.appendChild(opt);
      });
    } else if (el.numImagesRow) {
      el.numImagesRow.style.display = 'none';
    }

    // 12. Synchronized Audio / Sound Toggle (always visible on video models so support/savings are clear)
    const audioKey = getAudioSchemaKey(props);
    if (el.audioRow && el.audioCheckbox) {
      if (audioKey) {
        const audioProp = props[audioKey];
        el.audioRow.style.display = 'block';
        el.audioCheckbox.disabled = false;
        if (el.audioToggleLabel) {
          el.audioToggleLabel.style.opacity = '1';
          el.audioToggleLabel.style.cursor = 'pointer';
        }
        if (el.audioLabelText) {
          el.audioLabelText.textContent = (audioKey === 'keep_audio' || audioKey === 'keep_original_sound')
            ? 'Keep Source Audio'
            : 'Generate Synchronized Audio';
        }
        el.audioCheckbox.checked = useEconomyDefaults
          ? false
          : (audioProp?.default !== undefined ? Boolean(audioProp.default) : false);
        updateAudioControlHint(model, audioKey, props);
      } else if (isVideoTabModel(model)) {
        el.audioRow.style.display = 'block';
        el.audioCheckbox.checked = false;
        el.audioCheckbox.disabled = true;
        if (el.audioToggleLabel) {
          el.audioToggleLabel.style.opacity = '0.68';
          el.audioToggleLabel.style.cursor = 'not-allowed';
        }
        if (el.audioLabelText) {
          el.audioLabelText.textContent = 'Audio Control';
        }
        updateAudioControlHint(model, null, props);
      } else {
        el.audioRow.style.display = 'none';
        el.audioCheckbox.disabled = false;
      }
    }

    // 13. Output Format (Dynamically populated from schema enum)
    const formatCol = document.getElementById('outputFormatCol');
    if ('output_format' in props && !props.output_format['x-hidden'] && formatCol && el.outputFormatSelect) {
      formatCol.style.display = 'block';
      el.outputFormatSelect.innerHTML = '';
      const fmtEnums = (Array.isArray(props.output_format.enum) && props.output_format.enum.length > 0)
        ? props.output_format.enum
        : ['png', 'jpeg', 'webp'];
      const schemaFmtDef = (props.output_format.default && fmtEnums.includes(props.output_format.default))
        ? props.output_format.default
        : fmtEnums[0];
      const defFmt = (useEconomyDefaults && (model.formula || '').includes('output_format'))
        ? pickCheapestEnumOption(model, 'output_format', fmtEnums, () => 0, { images: ['img1'] })
        : schemaFmtDef;
      fmtEnums.forEach(fmt => {
        const opt = document.createElement('option');
        opt.value = fmt;
        opt.textContent = fmt.toUpperCase();
        if (fmt === defFmt) opt.selected = true;
        el.outputFormatSelect.appendChild(opt);
      });
    } else if (formatCol) {
      formatCol.style.display = 'none';
    }

    // 14. Extra Video Controls (movement_amplitude, shot_type, preset, camera_fixed)
    const populateSelectEnum = (selectEl, colEl, prop) => {
      if (!selectEl || !colEl) return false;
      if (!prop || prop['x-hidden']) {
        colEl.style.display = 'none';
        return false;
      }
      const vals = Array.isArray(prop.enum) ? prop.enum : [];
      if (vals.length === 0) {
        colEl.style.display = 'none';
        return false;
      }
      colEl.style.display = 'block';
      selectEl.innerHTML = '';
      const def = (prop.default !== undefined && vals.includes(prop.default)) ? prop.default : vals[0];
      vals.forEach(v => {
        const opt = document.createElement('option');
        opt.value = v;
        opt.textContent = String(v);
        if (v === def) opt.selected = true;
        selectEl.appendChild(opt);
      });
      return true;
    };
    const showMov = populateSelectEnum(el.movementAmpSelect, el.movementAmpCol, props.movement_amplitude);
    const showShot = populateSelectEnum(el.shotTypeSelect, el.shotTypeCol, props.shot_type);
    const showPreset = populateSelectEnum(el.presetSelect, el.presetCol, props.preset);
    const showCamFixed = Boolean('camera_fixed' in props && !props.camera_fixed['x-hidden'] && el.cameraFixedCol && el.cameraFixedCheckbox);
    if (el.cameraFixedCol) {
      el.cameraFixedCol.style.display = showCamFixed ? 'flex' : 'none';
      if (showCamFixed && el.cameraFixedCheckbox) {
        el.cameraFixedCheckbox.checked = Boolean(props.camera_fixed.default ?? false);
      }
    }
    if (el.advancedMotionGroup) {
      el.advancedMotionGroup.style.display = (showMov || showShot || showPreset || showCamFixed) ? 'block' : 'none';
    }

    // Update Action Button Text
    el.btnLabel.textContent = `Run ${model.model_id.split('/').pop()}`;
    updateInputQualityAdvisory();
  }

  // Upload Local File to Wavespeed Storage (uses raw binary stream endpoint for large videos/audio, falls back to base64 JSON in mocks)
  async function uploadFileDirect(file) {
    if (file && typeof file.arrayBuffer === 'function') {
      const buf = await file.arrayBuffer();
      const res = await fetch('/api/upload-raw', {
        method: 'POST',
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
          'X-File-Name': encodeURIComponent(file.name || 'upload.bin')
        },
        body: buf
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error || 'Upload failed');
      }
      return json.data.download_url;
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64Data = reader.result;
          const res = await fetch('/api/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              filename: file.name,
              mimeType: file.type,
              base64Data
            })
          });
          const json = await res.json();
          if (!res.ok || json.error) {
            throw new Error(json.error || 'Upload failed');
          }
          resolve(json.data.download_url);
        } catch (e) {
          reject(e);
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // Upload Canvas Mask as Image
  async function uploadMaskDirect() {
    return new Promise((resolve, reject) => {
      const base64Data = el.maskCanvas.toDataURL('image/png');
      fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: 'mask.png',
          mimeType: 'image/png',
          base64Data
        })
      })
      .then(r => r.json())
      .then(json => {
        if (json.data && json.data.download_url) resolve(json.data.download_url);
        else reject(new Error('Mask upload failed'));
      })
      .catch(reject);
    });
  }

  // Accidental Spend Guard Confirmation Modal
  function confirmSpendGuard(model, pricing) {
    const batchCount = Number(pricing.batchCount) || 1;
    const totalCost = batchCount > 1 ? Number(pricing.batchTotalPrice || pricing.finalPrice) : Number(pricing.finalPrice);
    const pendingSpend = getPendingJobsSpend();
    return new Promise((resolve) => {
      if (!el.spendConfirmModal) {
        const ok = window.confirm(`Confirm generation on ${model.name || model.model_id} for $${totalCost}?`);
        resolve(ok);
        return;
      }

      const props = model.schema?.properties || {};
      const exceedsBal = state.balance > 0 && (totalCost + pendingSpend) > state.balance;
      el.spendConfirmHeadline.textContent = exceedsBal
        ? `Warning: Total estimated cost ($${totalCost.toFixed(4)}${pendingSpend > 0 ? ` + $${pendingSpend.toFixed(4)} active` : ''}) exceeds your current WaveSpeed balance ($${state.balance.toFixed(4)}).`
        : `This ${batchCount > 1 ? `batch (${batchCount}× runs)` : 'generation'} exceeds your Spend Guard threshold of $${state.spendGuardThreshold.toFixed(2)}.`;

      const paramParts = [];
      if ('resolution' in props && !props.resolution['x-hidden']) paramParts.push(pricing.resVal);
      if ('size' in props && !props.size['x-hidden'] && el.sizeSelect?.value) paramParts.push(el.sizeSelect.value);
      if ('duration' in props && !props.duration['x-hidden']) paramParts.push(`${pricing.durVal}s`);
      if ('quality' in props && !props.quality['x-hidden']) paramParts.push(`quality: ${pricing.qualVal}`);
      if ('num_images' in props && !props.num_images['x-hidden']) paramParts.push(`${pricing.numImagesVal} img`);
      if (batchCount > 1) paramParts.push(`${batchCount}× batch`);
      if (getAudioSchemaKey(props)) {
        paramParts.push(el.audioCheckbox?.checked ? 'audio: ON' : 'audio: OFF');
      }

      const remaining = state.balance > 0 ? Math.max(0, state.balance - pendingSpend - totalCost).toFixed(4) : 'N/A';
      el.spendConfirmDetails.innerHTML = `
        <span class="spend-summary-label">Model</span>
        <span class="spend-summary-value">${escapeHtml(model.name || model.model_id)}</span>
        <span class="spend-summary-label">Configuration</span>
        <span class="spend-summary-value">${escapeHtml(paramParts.join(' • ') || 'Default')}</span>
        <span class="spend-summary-label">Estimated Cost</span>
        <span class="spend-summary-value highlight">$${totalCost.toFixed(4)}${batchCount > 1 ? ` (${batchCount}× $${pricing.finalPrice.toFixed(4)})` : ''}</span>
        <span class="spend-summary-label">Current Balance</span>
        <span class="spend-summary-value">$${state.balance.toFixed(4)}${pendingSpend > 0 ? ` (-$${pendingSpend.toFixed(4)} in-flight)` : ''}</span>
        <span class="spend-summary-label">Balance After Run</span>
        <span class="spend-summary-value">${remaining === 'N/A' ? 'N/A' : `$${remaining}`}</span>
      `;

      if (exceedsBal) {
        el.spendConfirmWarning.style.display = 'block';
        el.spendConfirmWarning.textContent = `Short by $${((totalCost + pendingSpend) - state.balance).toFixed(4)} vs current balance. Lower resolution, duration, or batch count to save credits.`;
      } else {
        el.spendConfirmWarning.style.display = 'none';
      }

      el.confirmSpendBtn.textContent = batchCount > 1 ? `Confirm & Run ×${batchCount} ($${totalCost.toFixed(4)})` : `Confirm & Run ($${totalCost.toFixed(4)})`;
      el.spendConfirmModal.style.display = 'flex';

      const cleanup = (result) => {
        el.spendConfirmModal.style.display = 'none';
        el.confirmSpendBtn.removeEventListener('click', onConfirm);
        el.cancelSpendBtn.removeEventListener('click', onCancel);
        el.closeSpendModalBtn.removeEventListener('click', onCancel);
        el.spendConfirmModal.removeEventListener('click', onBackdrop);
        document.removeEventListener('keydown', onEscape);
        resolve(result);
      };
      const onConfirm = () => cleanup(true);
      const onCancel = () => cleanup(false);
      const onBackdrop = (e) => { if (e.target === el.spendConfirmModal) cleanup(false); };
      const onEscape = (e) => { if (e.key === 'Escape') cleanup(false); };

      el.confirmSpendBtn.addEventListener('click', onConfirm);
      el.cancelSpendBtn.addEventListener('click', onCancel);
      el.closeSpendModalBtn.addEventListener('click', onCancel);
      el.spendConfirmModal.addEventListener('click', onBackdrop);
      document.addEventListener('keydown', onEscape);
    });
  }

  function getPendingJobsSpend() {
    let total = 0;
    if (!(state.activeJobs instanceof Map)) return 0;
    state.activeJobs.forEach(job => {
      if (job && job.status === 'running') {
        total += Number(job.estimatedPrice) || 0;
      }
    });
    return total;
  }

  function updateSidebarBalanceProjection(model = state.selectedModel, pricing = null) {
    if (!el.sidebarBalanceProjection) return;
    const bal = Number(state.balance) || 0;
    const pendingSpend = getPendingJobsSpend();
    if (bal <= 0) {
      el.sidebarBalanceProjection.textContent = pendingSpend > 0
        ? `In-flight cost: -$${pendingSpend.toFixed(4)}`
        : 'Sync balance to preview reduction';
      return;
    }
    const p = pricing || (model ? getModelPricing(model) : null);
    const runCost = p ? (Number(p.batchCount > 1 ? p.batchTotalPrice : p.finalPrice) || 0) : 0;
    const bTag = (p && p.batchCount > 1) ? ` (×${p.batchCount})` : '';
    if (pendingSpend > 0 && runCost > 0) {
      el.sidebarBalanceProjection.textContent = `This run${bTag}: -$${runCost.toFixed(4)} • Active: -$${pendingSpend.toFixed(4)} → Left: $${Math.max(0, bal - pendingSpend - runCost).toFixed(4)}`;
    } else if (pendingSpend > 0) {
      el.sidebarBalanceProjection.textContent = `Active runs: -$${pendingSpend.toFixed(4)} → After active: $${Math.max(0, bal - pendingSpend).toFixed(4)}`;
    } else if (runCost > 0) {
      const pct = ((runCost / bal) * 100).toFixed(1);
      el.sidebarBalanceProjection.textContent = `Next run${bTag}: -$${runCost.toFixed(4)} (-${pct}%) → $${Math.max(0, bal - runCost).toFixed(4)}`;
    } else {
      el.sidebarBalanceProjection.textContent = 'Select a model to preview balance after run';
    }
  }

  function updateRunButtonLabel() {
    const runningCount = state.activeJobs instanceof Map
      ? Array.from(state.activeJobs.values()).filter(j => j.status === 'running').length
      : 0;
    if (el.btnLabel) {
      el.btnLabel.textContent = runningCount > 0
        ? `Run Generation (${runningCount} running)`
        : 'Run Generation';
    }
    if (el.generateBtn) {
      // Never block concurrent runs — always stay clickable!
      el.generateBtn.disabled = false;
    }
  }

  // Execute Generation (Immediate Parallel Dispatch — No Queue Blocking)
  async function runGeneration() {
    if (!state.selectedModel) {
      alert('Please select a model first.');
      return;
    }

    const model = state.selectedModel;
    const props = model.schema?.properties || {};
    const payload = {};
    const reqList = model.schema?.required || [];

    // 1. Snapshot & validate inputs BEFORE spend guard or async work
    const promptVal = ('prompt' in props && !props.prompt['x-hidden']) ? el.promptInput.value.trim() : '';
    if ('prompt' in props && !props.prompt['x-hidden']) {
      if (!promptVal && reqList.includes('prompt')) {
        alert('Prompt is required for this model.');
        el.promptInput.focus();
        return;
      }
      if (promptVal) payload.prompt = promptVal;
    }

    const singleImageKey = getSingleImageSchemaKey(props);
    const hasSingleImageSlot = Boolean(singleImageKey || model.isImageToVideo);
    const hasImageInput = hasSingleImageSlot || 'images' in props || 'reference_images' in props || (isR2VModel(model) && 'reference_files' in props);
    const imageUrlSnapshot = hasSingleImageSlot ? (state.sourceImage?.downloadUrl || el.imageUrlInput.value.trim()) : '';
    const imageFileSnapshot = hasSingleImageSlot ? (state.sourceImage?.file || null) : null;
    const sourceImageObjSnapshot = hasSingleImageSlot ? state.sourceImage : null;
    const extraImagesSnapshot = Array.isArray(state.extraImages) ? state.extraImages.map(x => ({ ...x })) : [];
    const hasLastImageInput = 'last_image' in props && !props.last_image['x-hidden'];
    const lastImageUrlSnapshot = state.lastImage?.downloadUrl || (el.lastImageUrlInput ? el.lastImageUrlInput.value.trim() : '');
    const lastImageFileSnapshot = state.lastImage?.file || null;
    const lastImageObjSnapshot = state.lastImage;
    if (hasImageInput) {
      const needsImg = reqList.includes('image') || reqList.includes('face_image') || reqList.includes('images') || reqList.includes('reference_images');
      if (!imageUrlSnapshot && !imageFileSnapshot && extraImagesSnapshot.length === 0 && needsImg) {
        alert('Please provide at least one image input for this model.');
        return;
      }
    }
    if (hasLastImageInput && reqList.includes('last_image') && !lastImageUrlSnapshot && !lastImageFileSnapshot) {
      alert('Please provide an end frame (last image) for this model.');
      return;
    }

    const hasVideoInput = 'video' in props;
    const videoUrlSnapshot = state.sourceVideo?.downloadUrl || el.videoUrlInput.value.trim();
    const videoFileSnapshot = state.sourceVideo?.file || null;
    const sourceVideoObjSnapshot = state.sourceVideo;
    if (hasVideoInput) {
      if (!videoUrlSnapshot && !videoFileSnapshot && reqList.includes('video')) {
        alert('Please select or provide a video for this model.');
        return;
      }
    }

    const refVidKey = getRefVideosSchemaKey(props, model);
    const refVideosSnapshot = refVidKey ? (Array.isArray(state.refVideos) ? state.refVideos.map(x => ({ ...x })) : []) : [];
    const manualRefVids = (refVidKey && el.refVideosInput && el.refVideosInput.style.display !== 'none')
      ? el.refVideosInput.value.split(/[\r\n,]+/).map(s => s.trim()).filter(Boolean)
      : [];
    const refAudKey = getRefAudiosSchemaKey(props);
    const refAudiosSnapshot = refAudKey ? (Array.isArray(state.refAudios) ? state.refAudios.map(x => ({ ...x })) : []) : [];

    if (refVidKey && reqList.includes(refVidKey) && refVideosSnapshot.length === 0 && manualRefVids.length === 0) {
      if (!(refVidKey === 'reference_files' && (extraImagesSnapshot.length > 0 || imageUrlSnapshot || imageFileSnapshot))) {
        alert('Please upload or paste at least one reference video (or reference file) for this model.');
        return;
      }
    }

    const needsMaskUpload = ('mask_image' in props && (state.hasDrawnMask || reqList.includes('mask_image')));
    const activeRatio = ('aspect_ratio' in props && !props.aspect_ratio['x-hidden'])
      ? (document.querySelector('.ratio-pill.active')?.dataset.ratio || props.aspect_ratio.default || '1:1')
      : null;

    if (activeRatio) payload.aspect_ratio = activeRatio;
    const activeResKey = getResolutionSchemaKey(props);
    if (activeResKey && el.resolutionSelect && el.resolutionSelect.value) {
      payload[activeResKey] = el.resolutionSelect.value;
    }
    if ('duration' in props && !props.duration['x-hidden'] && el.durationSelect && el.durationSelect.value !== '') {
      payload.duration = Number(el.durationSelect.value);
    }
    if ('size' in props && !props.size['x-hidden'] && el.sizeSelect && el.sizeSelect.value) {
      payload.size = el.sizeSelect.value;
    }
    if ('quality' in props && !props.quality['x-hidden'] && el.qualitySelect && el.qualitySelect.value) {
      payload.quality = props.quality.type === 'integer'
        ? parseInt(el.qualitySelect.value, 10)
        : (props.quality.type === 'number' ? parseFloat(el.qualitySelect.value) : el.qualitySelect.value);
    }
    if ('num_images' in props && !props.num_images['x-hidden'] && el.numImagesSelect && el.numImagesSelect.value) {
      payload.num_images = parseInt(el.numImagesSelect.value, 10);
    }
    const activeAudioKey = getAudioSchemaKey(props);
    if (activeAudioKey && el.audioCheckbox) {
      payload[activeAudioKey] = Boolean(el.audioCheckbox.checked);
    }
    if ('output_format' in props && !props.output_format['x-hidden'] && el.outputFormatSelect && el.outputFormatSelect.value) {
      payload.output_format = el.outputFormatSelect.value;
    }
    if ('strength' in props && !props.strength['x-hidden']) {
      payload.strength = parseFloat(el.strengthSlider.value);
    }
    if ('negative_prompt' in props && !props.negative_prompt['x-hidden'] && el.negativePromptInput) {
      const negVal = el.negativePromptInput.value.trim();
      if (negVal) payload.negative_prompt = negVal;
    }
    if ('movement_amplitude' in props && !props.movement_amplitude['x-hidden'] && el.movementAmpSelect?.value) {
      payload.movement_amplitude = el.movementAmpSelect.value;
    }
    if ('shot_type' in props && !props.shot_type['x-hidden'] && el.shotTypeSelect?.value) {
      payload.shot_type = el.shotTypeSelect.value;
    }
    if ('preset' in props && !props.preset['x-hidden'] && el.presetSelect?.value) {
      payload.preset = el.presetSelect.value;
    }
    if ('camera_fixed' in props && !props.camera_fixed['x-hidden'] && el.cameraFixedCheckbox) {
      payload.camera_fixed = Boolean(el.cameraFixedCheckbox.checked);
    }
    const seed = parseInt(el.seedInput.value, 10);
    if ('seed' in props && !isNaN(seed) && seed !== -1) {
      payload.seed = seed;
    }

    const preUpscaleEnabled = Boolean(
      el.preUpscaleCheckbox?.checked &&
      el.preUpscaleLabel?.style.display !== 'none' &&
      hasSingleImageSlot &&
      (imageUrlSnapshot || imageFileSnapshot)
    );

    // 2. Accidental Spend Guard check (covers full batch matrix + active concurrent spend)
    const pricing = getModelPricing(model);
    const estimatedPrice = Number(pricing.finalPrice) || 0;
    const totalBatchPrice = pricing.batchCount > 1 ? Number(pricing.batchTotalPrice || estimatedPrice) : estimatedPrice;
    const pendingSpend = getPendingJobsSpend();
    const overThreshold = state.spendGuardEnabled && totalBatchPrice > state.spendGuardThreshold;
    const overBalance = state.balance > 0 && (totalBatchPrice + pendingSpend) > state.balance;
    if (overThreshold || overBalance) {
      const approved = await confirmSpendGuard(model, pricing);
      if (!approved) return;
    }

    // Expand {a | b} prompt variants × batch seed count (capped safely at 12 runs)
    const promptVariants = ('prompt' in props && !props.prompt['x-hidden'])
      ? expandPromptBraces(promptVal, 12)
      : [promptVal];
    const seedRepeats = Math.max(1, Math.min(4, parseInt(el.batchSeedsSelect?.value || '1', 10) || 1));
    const runSpecs = [];
    for (const pv of promptVariants) {
      for (let r = 0; r < seedRepeats; r++) {
        if (runSpecs.length >= 12) break;
        const jobPayload = { ...payload };
        if (pv) jobPayload.prompt = pv;
        if ('seed' in props && !isNaN(seed) && seed !== -1) {
          jobPayload.seed = seed + runSpecs.length;
        }
        runSpecs.push({ promptText: pv || el.promptInput.value || '', jobPayload });
      }
      if (runSpecs.length >= 12) break;
    }

    // 3. Dispatch job(s) concurrently WITHOUT disabling Run button
    runSpecs.forEach((spec) => {
      state.jobCounter += 1;
      const job = {
        jobId: `job-${state.jobCounter}`,
        taskId: null,
        model,
        modelId: model.model_id,
        modelName: model.name || model.model_id,
        category: model.category || state.currentCategory,
        prompt: spec.promptText,
        inputImageUrl: imageUrlSnapshot || sourceImageObjSnapshot?.url || null,
        parameters: { ...spec.jobPayload },
        estimatedPrice,
        balanceBefore: state.balance,
        status: 'running',
        stageText: 'Preparing assets...',
        errorTip: '',
        startTime: Date.now(),
        elapsedSec: 0,
        pollTimer: null,
        cancelled: false
      };

      state.activeJobs.set(job.jobId, job);
      ensureActiveJobsTicker();
      renderActiveJobs();
      if (state.selectedModel) updateModelInfo(state.selectedModel);

      // Fire asynchronously without awaiting so user can launch additional jobs right away
      executeConcurrentJob(job, {
        model,
        props,
        reqList,
        payload: spec.jobPayload,
        hasSingleImageSlot,
        hasImageInput,
        imageUrlSnapshot,
        imageFileSnapshot,
        sourceImageObjSnapshot,
        extraImagesSnapshot,
        hasLastImageInput,
        lastImageUrlSnapshot,
        lastImageFileSnapshot,
        lastImageObjSnapshot,
        hasVideoInput,
        videoUrlSnapshot,
        videoFileSnapshot,
        sourceVideoObjSnapshot,
        refVidKey,
        refVideosSnapshot,
        manualRefVids,
        refAudKey,
        refAudiosSnapshot,
        needsMaskUpload,
        preUpscaleEnabled
      });
    });
  }

  async function runPreUpscaleOnImage(imageUrl, job) {
    const unitCost = getPreUpscaleUnitCost();
    job.stageText = `Pre-upscaling low-res frame via Real-ESRGAN ($${unitCost.toFixed(4)})...`;
    renderActiveJobs();
    const submitRes = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model_id: 'wavespeed-ai/real-esrgan',
        model_name: 'Real-ESRGAN Pre-Upscale',
        category: 'utility',
        payload: { image: imageUrl },
        estimated_price: unitCost
      })
    });
    const submitData = await submitRes.json();
    if (!submitRes.ok || submitData.error) {
      throw new Error(submitData.error || submitData.message || 'Pre-upscale failed to start');
    }
    const taskId = submitData.data?.id || submitData.id;
    if (!taskId) throw new Error('Pre-upscale returned no task ID');

    while (!job.cancelled) {
      await new Promise(r => setTimeout(r, 1200));
      const res = await fetch(`/api/task/${taskId}`);
      const json = await res.json();
      const d = json.data || json;
      if (d.status === 'completed') {
        const outs = Array.isArray(d.outputs) ? d.outputs : [];
        const upscaledUrl = outs[0] || d.local_outputs?.[0]?.remote_url || d.local_outputs?.[0]?.local_url;
        if (!upscaledUrl) throw new Error('Pre-upscale completed without output URL');
        fetchBalance();
        return upscaledUrl;
      }
      if (d.status === 'failed') {
        throw new Error(d.error || 'Pre-upscale task failed');
      }
    }
    throw new Error('Cancelled');
  }

  async function resolveMediaAssetUrl(urlSnapshot, fileSnapshot, targetObj, defaultName, defaultMime, job, label) {
    if (urlSnapshot && urlSnapshot.startsWith('/outputs/')) {
      job.stageText = `Uploading local ${label} to WaveSpeed...`;
      renderActiveJobs();
      const resp = await fetch(urlSnapshot);
      if (!resp.ok) throw new Error(`Failed to read local ${label} for upload`);
      const blob = await resp.blob();
      const fName = urlSnapshot.split('/').pop() || defaultName;
      const localFile = new File([blob], fName, { type: blob.type || defaultMime });
      const uploaded = await uploadFileDirect(localFile);
      if (targetObj) targetObj.downloadUrl = uploaded;
      return uploaded;
    }
    if (!urlSnapshot && fileSnapshot) {
      job.stageText = `Uploading ${label} to WaveSpeed...`;
      renderActiveJobs();
      const uploaded = await uploadFileDirect(fileSnapshot);
      if (targetObj) targetObj.downloadUrl = uploaded;
      return uploaded;
    }
    return urlSnapshot;
  }

  async function executeConcurrentJob(job, ctx) {
    try {
      const { model, props, reqList, payload } = ctx;
      let resolvedReferenceFileUrls = [];

      if (ctx.hasImageInput) {
        let finalImageUrl = ctx.hasSingleImageSlot
          ? await resolveMediaAssetUrl(
              ctx.imageUrlSnapshot,
              ctx.imageFileSnapshot,
              ctx.sourceImageObjSnapshot,
              'source.png',
              'image/png',
              job,
              'source image'
            )
          : '';
        if (ctx.preUpscaleEnabled && finalImageUrl) {
          finalImageUrl = await runPreUpscaleOnImage(finalImageUrl, job);
          if (job.cancelled) return;
        }
        const uploadedExtras = [];
        if (Array.isArray(ctx.extraImagesSnapshot) && ctx.extraImagesSnapshot.length > 0) {
          job.stageText = `Uploading ${ctx.extraImagesSnapshot.length} reference image(s)...`;
          renderActiveJobs();
          for (const extra of ctx.extraImagesSnapshot) {
            if (extra.downloadUrl && !extra.downloadUrl.startsWith('/outputs/')) {
              uploadedExtras.push(extra.downloadUrl);
            } else if (extra.downloadUrl || extra.file) {
              const url = await resolveMediaAssetUrl(
                extra.downloadUrl,
                extra.file,
                extra,
                'ref.png',
                'image/png',
                job,
                'reference image'
              );
              if (url) uploadedExtras.push(url);
            }
          }
        }
        const allImageUrls = [finalImageUrl, ...uploadedExtras].filter(Boolean);
        if (allImageUrls.length === 0 && (reqList.includes('image') || reqList.includes('face_image') || reqList.includes('images') || reqList.includes('reference_images'))) {
          throw new Error('Please provide a source image for this model.');
        }
        if (allImageUrls.length > 0) {
          if ('image' in props) payload.image = allImageUrls[0];
          if ('face_image' in props) payload.face_image = allImageUrls[0];
          if ('images' in props) payload.images = allImageUrls;
          if ('reference_images' in props) payload.reference_images = allImageUrls;
          if (ctx.refVidKey === 'reference_files') resolvedReferenceFileUrls.push(...allImageUrls);
        }
      }

      if (ctx.hasLastImageInput) {
        const finalLastUrl = await resolveMediaAssetUrl(
          ctx.lastImageUrlSnapshot,
          ctx.lastImageFileSnapshot,
          ctx.lastImageObjSnapshot,
          'last_frame.png',
          'image/png',
          job,
          'end frame'
        );
        if (!finalLastUrl && reqList.includes('last_image')) {
          throw new Error('Please provide an end frame (last image) for this model.');
        }
        if (finalLastUrl) {
          payload.last_image = finalLastUrl;
        }
      }

      if (ctx.needsMaskUpload) {
        job.stageText = 'Uploading inpainting mask...';
        renderActiveJobs();
        payload.mask_image = await uploadMaskDirect();
      }

      if (ctx.hasVideoInput) {
        const videoUrl = await resolveMediaAssetUrl(
          ctx.videoUrlSnapshot,
          ctx.videoFileSnapshot,
          ctx.sourceVideoObjSnapshot,
          'clip.mp4',
          'video/mp4',
          job,
          'video asset'
        );
        if (!videoUrl && reqList.includes('video')) {
          throw new Error('Please select or provide a video for this model.');
        }
        if (videoUrl) payload.video = videoUrl;
      }

      if (ctx.refVidKey) {
        const uploadedRefVids = [];
        for (const rv of (ctx.refVideosSnapshot || [])) {
          const rUrl = await resolveMediaAssetUrl(
            rv.downloadUrl || rv.url || '',
            rv.file || null,
            rv,
            rv.name || 'ref-video.mp4',
            rv.file?.type || 'video/mp4',
            job,
            'reference video'
          );
          if (rUrl) uploadedRefVids.push(rUrl);
        }
        for (const mUrl of (ctx.manualRefVids || [])) {
          if (!uploadedRefVids.includes(mUrl)) uploadedRefVids.push(mUrl);
        }
        if (ctx.refVidKey === 'reference_files') {
          const combined = [...resolvedReferenceFileUrls, ...uploadedRefVids].filter(Boolean);
          if (combined.length > 0) payload.reference_files = combined;
        } else if (uploadedRefVids.length > 0) {
          payload[ctx.refVidKey] = uploadedRefVids;
        }
      }

      if (ctx.refAudKey && Array.isArray(ctx.refAudiosSnapshot) && ctx.refAudiosSnapshot.length > 0) {
        const uploadedAuds = [];
        for (const ra of ctx.refAudiosSnapshot) {
          const aUrl = await resolveMediaAssetUrl(
            ra.downloadUrl || ra.url || '',
            ra.file || null,
            ra,
            ra.name || 'ref-audio.mp3',
            ra.file?.type || 'audio/mpeg',
            job,
            'reference audio'
          );
          if (aUrl) uploadedAuds.push(aUrl);
        }
        if (uploadedAuds.length > 0) {
          payload[ctx.refAudKey] = (props[ctx.refAudKey]?.type === 'string') ? uploadedAuds[0] : uploadedAuds;
        }
      }

      if (job.cancelled) return;

      job.stageText = `Submitting to ${model.model_id}...`;
      renderActiveJobs();

      const submitRes = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model_id: model.model_id,
          model_name: model.name || model.model_id,
          category: job.category,
          payload,
          estimated_price: job.estimatedPrice
        })
      });

      const submitData = await submitRes.json();
      if (!submitRes.ok || submitData.error) {
        throw new Error(submitData.error || submitData.message || 'Generation failed to start');
      }

      const taskId = submitData.data?.id || submitData.id;
      if (!taskId) {
        throw new Error('No task ID returned by WaveSpeed API');
      }

      job.taskId = taskId;
      job.stageText = `Queued / Processing (${taskId.slice(0, 10)}...)`;
      renderActiveJobs();
      pollConcurrentJob(job);
    } catch (err) {
      console.error(err);
      job.status = 'error';
      job.stageText = `Failed: ${err.message}`;
      job.elapsedSec = (Date.now() - job.startTime) / 1000;
      renderActiveJobs();
      if (state.selectedModel) updateModelInfo(state.selectedModel);
    }
  }

  function pollConcurrentJob(job) {
    job.pollTimer = setInterval(async () => {
      if (job.cancelled) {
        clearInterval(job.pollTimer);
        job.pollTimer = null;
        return;
      }
      try {
        const res = await fetch(`/api/task/${job.taskId}`);
        const result = await res.json();
        const data = result.data || result;
        const status = data.status;

        if (status === 'completed') {
          clearInterval(job.pollTimer);
          job.pollTimer = null;
          job.status = 'completed';
          job.elapsedSec = (Date.now() - job.startTime) / 1000;
          const outputs = data.outputs || [];
          const localOutputs = data.local_outputs || [];
          if (outputs.length > 0) {
            job.stageText = `Completed (${outputs.length} output${outputs.length > 1 ? 's' : ''}) in ${job.elapsedSec.toFixed(1)}s`;
            handleOutputSuccess(outputs, job.model, localOutputs, job);
          } else {
            job.status = 'error';
            job.stageText = 'Completed with no outputs returned.';
          }
          renderActiveJobs();
          await fetchBalance();
          if (state.selectedModel) updateModelInfo(state.selectedModel);
        } else if (['failed', 'cancelled', 'timeout'].includes(status)) {
          clearInterval(job.pollTimer);
          job.pollTimer = null;
          job.status = 'error';
          job.elapsedSec = (Date.now() - job.startTime) / 1000;
          const errMsg = data.error || 'Unknown reason';
          const isSensitiveBlock = /sensitive|flagged|safety|nsfw|moderation/i.test(errMsg);
          job.stageText = `Status: ${status} — ${errMsg}`;
          job.errorTip = isSensitiveBlock
            ? 'Tip: Upstream endpoints (like alibaba/wan-3.0) moderate explicit content even on -spicy tags. Try WaveSpeed open-weights: minimax-h3/image-to-video-spicy ($0.02/s @ 480p), ltx-2.3-spicy, or wan-2.2-spicy.'
            : '';
          renderActiveJobs();
          await fetchBalance();
          if (state.selectedModel) updateModelInfo(state.selectedModel);
        } else {
          job.stageText = `Status: ${status || 'processing'} • Task: ${job.taskId.slice(0, 12)}...`;
        }
      } catch (err) {
        console.warn('Polling error:', err);
      }
    }, 2000);
  }

  function ensureActiveJobsTicker() {
    if (state.activeJobsTickTimer) return;
    state.activeJobsTickTimer = setInterval(() => {
      if (!(state.activeJobs instanceof Map) || state.activeJobs.size === 0) {
        clearInterval(state.activeJobsTickTimer);
        state.activeJobsTickTimer = null;
        return;
      }
      let anyRunning = false;
      state.activeJobs.forEach(job => {
        if (job.status === 'running') {
          anyRunning = true;
          const timerEl = document.getElementById(`job-timer-${job.jobId}`);
          if (timerEl) {
            timerEl.textContent = `${((Date.now() - job.startTime) / 1000).toFixed(1)}s`;
          }
        }
      });
      if (!anyRunning) {
        clearInterval(state.activeJobsTickTimer);
        state.activeJobsTickTimer = null;
      }
    }, 100);
  }

  function renderActiveJobs() {
    updateRunButtonLabel();
    updateSidebarBalanceProjection();
    if (!el.executionCard || !el.activeJobsList) return;

    const jobs = state.activeJobs instanceof Map ? Array.from(state.activeJobs.values()) : [];
    if (jobs.length === 0) {
      el.executionCard.style.display = 'none';
      el.activeJobsList.innerHTML = '';
      return;
    }

    el.executionCard.style.display = 'flex';
    const runningCount = jobs.filter(j => j.status === 'running').length;
    if (el.activeJobsCountBadge) {
      el.activeJobsCountBadge.textContent = runningCount > 0
        ? `${runningCount} running`
        : `${jobs.length} finished`;
    }
    if (el.execPulseDot) {
      el.execPulseDot.style.display = runningCount > 0 ? 'inline-block' : 'none';
    }
    if (el.cancelTaskBtn) {
      el.cancelTaskBtn.textContent = runningCount > 0 ? 'Stop All' : 'Clear';
    }

    el.activeJobsList.innerHTML = '';
    jobs.slice().reverse().forEach(job => {
      const card = document.createElement('div');
      card.className = `active-job-item${job.status === 'error' ? ' is-error' : (job.status === 'completed' ? ' is-done' : '')}`;

      const elapsed = job.status === 'running'
        ? `${((Date.now() - job.startTime) / 1000).toFixed(1)}s`
        : `${(job.elapsedSec || 0).toFixed(1)}s`;

      const top = document.createElement('div');
      top.className = 'active-job-top';
      top.innerHTML = `
        <span class="active-job-title">${job.status === 'running' ? '⚡' : (job.status === 'completed' ? '✅' : '⚠️')} ${escapeHtml(job.modelId)}</span>
        <div class="active-job-right">
          <span>-$${Number(job.estimatedPrice || 0).toFixed(4)}</span>
          <span class="exec-timer" id="job-timer-${escapeHtml(job.jobId)}">${elapsed}</span>
        </div>
      `;

      const dismissBtn = document.createElement('button');
      dismissBtn.type = 'button';
      dismissBtn.className = 'active-job-dismiss';
      dismissBtn.textContent = job.status === 'running' ? '✕ Stop' : '✕';
      dismissBtn.addEventListener('click', () => {
        job.cancelled = true;
        if (job.pollTimer) clearInterval(job.pollTimer);
        state.activeJobs.delete(job.jobId);
        renderActiveJobs();
        if (state.selectedModel) updateModelInfo(state.selectedModel);
      });
      top.querySelector('.active-job-right').appendChild(dismissBtn);

      const meta = document.createElement('div');
      meta.className = 'active-job-meta';
      meta.textContent = job.errorTip ? `${job.stageText}\n${job.errorTip}` : job.stageText;

      card.appendChild(top);
      card.appendChild(meta);

      if (job.status === 'running') {
        const barWrap = document.createElement('div');
        barWrap.className = 'progress-bar-container';
        barWrap.innerHTML = '<div class="progress-bar"></div>';
        card.appendChild(barWrap);
      }

      el.activeJobsList.appendChild(card);
    });
  }

  function getContainingDir(filePath) {
    if (!filePath || typeof filePath !== 'string') return state.outputsDir || './outputs';
    const cleaned = filePath.replace(/[\\/]+$/, '');
    const sepIdx = Math.max(cleaned.lastIndexOf('\\'), cleaned.lastIndexOf('/'));
    return sepIdx > 0 ? cleaned.slice(0, sepIdx) : cleaned;
  }

  function renderLocalSaveBanner(localPath) {
    if (!el.localSaveBanner) return;
    if (!localPath) {
      el.localSaveBanner.style.display = 'none';
      el.localSaveBanner.innerHTML = '';
      return;
    }
    const containingDir = getContainingDir(localPath);
    el.localSaveBanner.style.display = 'flex';
    el.localSaveBanner.innerHTML = `
      <span>💾 Saved in <strong class="local-save-path-link" id="localSavePathLink" title="Click to open containing folder & copy path">${escapeHtml(containingDir)}</strong></span>
      <div class="local-save-actions">
        <button type="button" class="btn-action-tool" id="copyActivePathBtn">📋 Copy Folder Path</button>
        <button type="button" class="btn-action-tool" id="openActiveFolderBtn">📁 Open Containing Folder</button>
      </div>
    `;
    const linkEl = document.getElementById('localSavePathLink');
    const copyBtn = document.getElementById('copyActivePathBtn');
    const openBtn = document.getElementById('openActiveFolderBtn');
    if (linkEl) linkEl.addEventListener('click', () => openOutputsFolder(localPath, 'folder'));
    if (openBtn) openBtn.addEventListener('click', () => openOutputsFolder(localPath, 'folder'));
    if (copyBtn) {
      copyBtn.addEventListener('click', async () => {
        const ok = await copyTextSafe(containingDir);
        copyBtn.textContent = ok ? '✓ Copied!' : '📋 Copy Folder Path';
        setTimeout(() => { copyBtn.textContent = '📋 Copy Folder Path'; }, 1600);
      });
    }
  }

  function updateViewerCostBadge(price) {
    if (!el.viewerCostBadge) return;
    const num = Number(price) || 0;
    if (num <= 0) {
      el.viewerCostBadge.style.display = 'none';
      return;
    }
    const bal = Number(state.balance) || 0;
    el.viewerCostBadge.style.display = 'inline-flex';
    el.viewerCostBadge.textContent = bal > 0
      ? `-$${num.toFixed(4)} • Bal: $${bal.toFixed(4)}`
      : `-$${num.toFixed(4)}`;
  }

  // Handle Successful Generation (supports single or multiple concurrent/batch outputs)
  function handleOutputSuccess(outputUrls, model, localSavedList = [], job = null) {
    const urls = Array.isArray(outputUrls) ? outputUrls : [outputUrls];
    const savedItems = Array.isArray(localSavedList) ? localSavedList : (localSavedList ? [localSavedList] : []);
    const primaryUrl = urls[0];
    const primarySaved = savedItems[0] || null;
    const completedTaskId = job?.taskId || primarySaved?.task_id || state.currentTaskId;
    const priceUsed = job ? job.estimatedPrice : getModelPricing(model).finalPrice;

    // Add all outputs to session history (reverse order so index 0 ends up first!)
    for (let i = urls.length - 1; i >= 0; i--) {
      const outUrl = urls[i];
      const saved = savedItems[i] || null;
      const localUrl = saved?.local_url || null;
      const remoteUrl = (outUrl && /^https?:\/\//i.test(outUrl) && !outUrl.includes('localhost')) ? outUrl : null;
      const displayUrl = localUrl || outUrl;
      const isVid = Boolean(displayUrl.match(/\.(mp4|webm|mov)(\?|$)/i) || model.isImageToVideo || model.isTextToVideoOrEdit || model.isVideoGen || model.isVideoEdit);

      addToHistory({
        task_id: completedTaskId || saved?.task_id || null,
        url: displayUrl,
        local_url: localUrl,
        remote_url: remoteUrl || outUrl,
        local_path: saved?.local_path || null,
        isVideo: isVid,
        model_id: model.model_id,
        prompt: job ? job.prompt : el.promptInput.value,
        input_image_url: job?.inputImageUrl || saved?.input_image_url || null,
        parameters: job?.parameters || saved?.parameters || null,
        price: priceUsed,
        timestamp: new Date().toISOString()
      });
    }

    const firstLocalUrl = primarySaved?.local_url || null;
    const firstRemoteUrl = (primaryUrl && /^https?:\/\//i.test(primaryUrl) && !primaryUrl.includes('localhost')) ? primaryUrl : null;
    const firstDisplayUrl = firstLocalUrl || primaryUrl;
    const firstIsVideo = Boolean(firstDisplayUrl.match(/\.(mp4|webm|mov)(\?|$)/i) || model.isImageToVideo || model.isTextToVideoOrEdit || model.isVideoGen || model.isVideoEdit);
    const activeItemObj = {
      task_id: completedTaskId || primarySaved?.task_id || null,
      url: firstDisplayUrl,
      local_url: firstLocalUrl,
      remote_url: firstRemoteUrl || primaryUrl,
      local_path: primarySaved?.local_path || null,
      isVideo: firstIsVideo,
      model_id: model.model_id,
      prompt: job ? job.prompt : el.promptInput.value,
      input_image_url: job?.inputImageUrl || primarySaved?.input_image_url || null,
      parameters: job?.parameters || primarySaved?.parameters || null,
      price: priceUsed,
      timestamp: new Date().toISOString()
    };

    loadOutputIntoViewer(activeItemObj);
    fetchHistoryStatsForInsights();

    // Multi-Step Quick Chain Post-Action (stages next workflow step without auto-spending credits)
    const chainAction = el.postChainSelect?.value || 'none';
    if (chainAction === 'load-timeline' && firstIsVideo) {
      openVideoInTimeline(firstDisplayUrl, 'Completed Output Clip');
    } else if (chainAction === 'animate-spicy' && !firstIsVideo) {
      const i2vBtn = document.querySelector('.mode-btn[data-category="image-to-video"]');
      if (i2vBtn) i2vBtn.click();
      selectModel('wavespeed-ai/minimax-h3/image-to-video-spicy', true).catch(() => {});
      state.sourceImage = { url: firstDisplayUrl, downloadUrl: firstRemoteUrl || firstDisplayUrl };
      if (el.imagePreview) el.imagePreview.src = firstDisplayUrl;
      if (el.imagePreviewContainer) el.imagePreviewContainer.style.display = 'flex';
      const dp = document.getElementById('dropzonePrompt');
      if (dp) dp.style.display = 'none';
      if (el.imageUrlInput) el.imageUrlInput.value = firstRemoteUrl || firstDisplayUrl;
      showToast('Auto-Chained still → MiniMax H3 Spicy (review & click Run)', 'good', 3500);
    } else if (chainAction === 'upscale-video' && firstIsVideo) {
      routeVideoToUpscaler({ url: firstRemoteUrl || firstDisplayUrl, local_url: firstLocalUrl, remote_url: firstRemoteUrl });
    }
  }

  // Legacy Execution Helpers kept safe for compatibility
  function showExecutionState(msg, progressPercent = 30) {
    if (el.executionCard) el.executionCard.style.display = 'flex';
    if (el.execStatusTitle) el.execStatusTitle.textContent = 'Active Generations';
    if (el.execDetails) el.execDetails.textContent = msg;
    if (el.execProgressBar) el.execProgressBar.style.width = `${progressPercent}%`;
  }

  function resetExecutionState() {
    if (state.activeJobs instanceof Map) {
      state.activeJobs.forEach(job => {
        job.cancelled = true;
        if (job.pollTimer) clearInterval(job.pollTimer);
      });
      state.activeJobs.clear();
    }
    if (state.activeJobsTickTimer) {
      clearInterval(state.activeJobsTickTimer);
      state.activeJobsTickTimer = null;
    }
    renderActiveJobs();
  }

  // Fetch permanently saved outputs from local outputs directory
  async function fetchSavedOutputs() {
    try {
      const res = await fetch('/api/outputs');
      const json = await res.json();
      if (json.outputs_dir) {
        applyOutputsDirUi(json.outputs_dir);
      }
      if (Array.isArray(json.data) && json.data.length > 0) {
        let changed = false;
        json.data.forEach(item => {
          const existing = state.history.find(h =>
            (item.task_id && h.task_id && h.task_id === item.task_id) ||
            (item.local_path && h.local_path && h.local_path === item.local_path) ||
            (item.local_url && (h.local_url === item.local_url || h.url === item.local_url)) ||
            (item.remote_url && (h.remote_url === item.remote_url || h.url === item.remote_url))
          );

          if (existing) {
            // Heal/upgrade localStorage entry so local disk file takes priority over potentially expired CDN URL
            if (item.local_url && existing.url !== item.local_url) {
              existing.url = item.local_url;
              changed = true;
            }
            if (item.local_url && !existing.local_url) {
              existing.local_url = item.local_url;
              changed = true;
            }
            if (item.local_path && !existing.local_path) {
              existing.local_path = item.local_path;
              changed = true;
            }
            if (item.task_id && !existing.task_id) {
              existing.task_id = item.task_id;
              changed = true;
            }
          } else {
            state.history.push({
              task_id: item.task_id || null,
              url: item.local_url || item.remote_url,
              local_url: item.local_url || null,
              remote_url: item.remote_url || null,
              local_path: item.local_path || null,
              isVideo: Boolean(item.is_video),
              model_id: item.model_id,
              prompt: item.prompt || '',
              input_image_url: item.input_image_url || item.parameters?.image || (Array.isArray(item.parameters?.images) ? item.parameters.images[0] : null) || null,
              parameters: item.parameters || null,
              price: item.estimated_price || 0,
              timestamp: item.saved_at
            });
            changed = true;
          }
        });
        if (changed) {
          state.history.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
          try {
            localStorage.setItem('wavespeed_studio_history', JSON.stringify(state.history.slice(0, 40)));
          } catch (e) {}
          renderHistory();
        }
      }
    } catch (e) {
      console.warn('Saved outputs fetch skipped:', e);
    }
  }

  // Sync Live Prices & Balance from WaveSpeed
  async function syncLivePrices() {
    try {
      if (el.syncPricesLabel) el.syncPricesLabel.textContent = 'Syncing...';
      const res = await fetch('/api/sync-prices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model_id: state.selectedModel?.model_id || null })
      });
      const json = await res.json();
      if (Array.isArray(json.data)) {
        state.models = json.data;
        if (state.selectedModel) {
          const updated = state.models.find(m => m.model_id === state.selectedModel.model_id);
          if (updated) state.selectedModel = updated;
        }
      }
      if (typeof json.balance === 'number') {
        state.balance = json.balance;
        el.balanceValue.textContent = `$${json.balance.toFixed(4)}`;
      } else {
        await fetchBalance();
      }
      if (state.selectedModel) {
        updateModelInfo(state.selectedModel);
      }
      filterAndRenderAutocomplete();
      if (el.syncPricesBtn) el.syncPricesBtn.classList.add('synced');
      if (el.syncPricesLabel) {
        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        el.syncPricesLabel.textContent = `✓ Live (${timeStr})`;
      }
    } catch (e) {
      console.error('Sync prices failed:', e);
      if (el.syncPricesLabel) el.syncPricesLabel.textContent = 'Sync Prices';
    }
  }

  async function copyTextSafe(text) {
    if (!text) return false;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (e) {}
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return Boolean(ok);
    } catch (e) {}
    return false;
  }

  async function requestNativeExplorer(filePath = null, mode = 'default') {
    const res = await fetch('/api/open-folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(filePath ? { filePath, mode } : { target: 'outputs', mode })
    });
    return await res.json();
  }

  function renderOutputsModal(items, highlightPath = null) {
    if (!el.outputsFileList || !el.outputsSummaryText) return;
    const list = Array.isArray(items) ? items : [];
    const videos = list.filter(i => i.is_video).length;
    const images = list.length - videos;
    const totalMb = list.reduce((acc, i) => acc + (i.size_bytes || 0), 0) / (1024 * 1024);
    el.outputsSummaryText.textContent = `${list.length} saved file${list.length === 1 ? '' : 's'} (${videos} video${videos === 1 ? '' : 's'}, ${images} image${images === 1 ? '' : 's'} • ${totalMb.toFixed(2)} MB total)`;

    el.outputsFileList.innerHTML = '';
    if (list.length === 0) {
      el.outputsFileList.innerHTML = '<div class="empty-gallery">No files saved on disk yet.</div>';
      return;
    }

    list.forEach((item) => {
      const row = document.createElement('div');
      const isHighlighted = Boolean(highlightPath && item.local_path === highlightPath);
      row.className = `outputs-file-row${isHighlighted ? ' is-highlighted' : ''}`;

      const fileName = (item.local_path || item.local_url || '').split(/[\\/]/).pop() || item.task_id || 'output';
      const sizeStr = item.size_bytes ? `${(item.size_bytes / (1024 * 1024)).toFixed(2)} MB` : '';
      const dateStr = item.saved_at ? new Date(item.saved_at).toLocaleString() : '';

      const thumbBox = document.createElement('div');
      thumbBox.className = 'outputs-file-thumb';
      const thumbSrc = item.local_url || item.remote_url || '';
      if (thumbSrc && !item.is_video) {
        thumbBox.innerHTML = `<img src="${escapeHtml(thumbSrc)}" loading="lazy" alt="thumb">`;
      } else if (thumbSrc && item.is_video) {
        thumbBox.innerHTML = `<video src="${escapeHtml(thumbSrc)}" muted preload="metadata"></video>`;
      } else {
        thumbBox.textContent = item.is_video ? '🎬' : '🖼️';
      }

      const info = document.createElement('div');
      info.className = 'outputs-file-info';
      info.innerHTML = `
        <div class="outputs-file-name">${item.is_video ? '🎬' : '🖼️'} ${escapeHtml(fileName)}</div>
        <div class="outputs-file-meta">${escapeHtml(item.model_id || 'unknown')} • ${sizeStr}${item.estimated_price ? ` • $${Number(item.estimated_price).toFixed(4)}` : ''}${dateStr ? ` • ${escapeHtml(dateStr)}` : ''}</div>
      `;

      const actions = document.createElement('div');
      actions.className = 'outputs-file-actions';

      const loadBtn = document.createElement('button');
      loadBtn.type = 'button';
      loadBtn.className = 'btn-action-tool';
      loadBtn.textContent = '👁️ View';
      loadBtn.addEventListener('click', () => {
        loadOutputIntoViewer({
          task_id: item.task_id || null,
          url: item.local_url || item.remote_url,
          local_url: item.local_url || null,
          remote_url: item.remote_url || null,
          local_path: item.local_path || null,
          isVideo: Boolean(item.is_video),
          model_id: item.model_id,
          prompt: item.prompt || '',
          price: item.estimated_price || 0,
          timestamp: item.saved_at
        });
        if (el.outputsModal) el.outputsModal.style.display = 'none';
      });

      const dlBtn = document.createElement('button');
      dlBtn.type = 'button';
      dlBtn.className = 'btn-action-tool';
      dlBtn.textContent = '⬇️ Save';
      dlBtn.addEventListener('click', () => {
        const href = item.local_url || item.remote_url;
        if (!href) return;
        const a = document.createElement('a');
        a.href = href;
        a.download = fileName;
        a.click();
      });

      const copyBtn = document.createElement('button');
      copyBtn.type = 'button';
      copyBtn.className = 'btn-action-tool';
      copyBtn.textContent = '📋 Path';
      copyBtn.addEventListener('click', async () => {
        const ok = await copyTextSafe(item.local_path || state.outputsDir);
        copyBtn.textContent = ok ? '✓ Copied' : '📋 Path';
        if (el.outputsModalStatus && item.local_path) {
          el.outputsModalStatus.textContent = ok
            ? `Copied file path: ${item.local_path}`
            : `File path: ${item.local_path}`;
        }
        setTimeout(() => { copyBtn.textContent = '📋 Path'; }, 1500);
      });

      const folderBtn = document.createElement('button');
      folderBtn.type = 'button';
      folderBtn.className = 'btn-action-tool';
      folderBtn.textContent = '📂 Folder';
      folderBtn.title = 'Open containing folder & copy folder path';
      folderBtn.addEventListener('click', async () => {
        const folderPath = getContainingDir(item.local_path || state.outputsDir);
        const [copied, res] = await Promise.all([
          copyTextSafe(folderPath),
          requestNativeExplorer(item.local_path || null, 'folder').catch(() => null)
        ]);
        if (el.outputsFolderPathCode) el.outputsFolderPathCode.textContent = folderPath;
        if (el.openContainingFolderTabBtn && res?.folder_browse_url) {
          el.openContainingFolderTabBtn.href = res.folder_browse_url;
        }
        if (el.outputsModalStatus) {
          el.outputsModalStatus.textContent = copied
            ? `📋 Folder path copied (${folderPath}) & Explorer requested. Or click "Open Folder in Tab" / press Win+R → Ctrl+V → Enter.`
            : `Containing folder requested: ${folderPath}`;
        }
      });

      actions.appendChild(loadBtn);
      actions.appendChild(dlBtn);
      actions.appendChild(copyBtn);
      actions.appendChild(folderBtn);
      row.appendChild(thumbBox);
      row.appendChild(info);
      row.appendChild(actions);
      el.outputsFileList.appendChild(row);
      if (isHighlighted && typeof row.scrollIntoView === 'function') {
        setTimeout(() => { row.scrollIntoView({ block: 'nearest' }); }, 60);
      }
    });
  }

  // Open local outputs folder (or containing subfolder) in-app modal + request OS file explorer
  async function openOutputsFolder(filePath = null, mode = 'default') {
    state.lastRequestedOutputPath = filePath || null;
    state.lastRequestedExplorerMode = mode || 'default';
    const containingDir = filePath ? getContainingDir(filePath) : (state.outputsDir || './outputs');
    const displayTarget = mode === 'folder' ? containingDir : (filePath || state.outputsDir || './outputs');

    if (el.outputsModal) {
      el.outputsModal.style.display = 'flex';
      if (el.outputsFolderPathCode) {
        el.outputsFolderPathCode.textContent = displayTarget;
      }
      if (el.outputsModalStatus) {
        el.outputsModalStatus.textContent = 'Opening folder and loading saved files...';
      }
    }

    try {
      const [explorerJson, outputsRes, copiedOk] = await Promise.all([
        requestNativeExplorer(filePath, mode).catch((err) => ({ success: false, explorer_error: err.message })),
        fetch('/api/outputs').then(r => r.json()).catch(() => ({ data: [] })),
        copyTextSafe(displayTarget)
      ]);

      if (outputsRes.outputs_dir) {
        state.outputsDir = outputsRes.outputs_dir;
        if (el.outputsFolderPathCode && !filePath) el.outputsFolderPathCode.textContent = outputsRes.outputs_dir;
      }
      if (el.openContainingFolderTabBtn) {
        el.openContainingFolderTabBtn.href = explorerJson?.folder_browse_url || '/outputs/';
      }
      const allItems = Array.isArray(outputsRes.data) ? outputsRes.data : [];
      const filteredItems = (mode === 'folder' && filePath)
        ? allItems.filter(x => x.local_path && getContainingDir(x.local_path).toLowerCase() === containingDir.toLowerCase())
        : allItems;
      renderOutputsModal(filteredItems.length > 0 ? filteredItems : allItems, filePath);

      if (el.outputsModalStatus) {
        const targetDisplay = explorerJson?.opened || displayTarget;
        const copyNote = copiedOk ? ' Path auto-copied — press Win+R → Ctrl+V → Enter or click "🌐 Open Folder in Tab".' : '';
        if (explorerJson && explorerJson.explorer_launched) {
          el.outputsModalStatus.textContent = `Requested Windows Explorer for "${targetDisplay}".${copyNote} (If running via Antigravity background daemon, launch via start.bat for direct OS Explorer windows.)`;
        } else {
          el.outputsModalStatus.textContent = `Could not launch Explorer automatically (${explorerJson?.explorer_error || 'desktop session isolated'}).${copyNote}`;
        }
      }
    } catch (e) {
      console.error('Open folder failed:', e);
      if (el.outputsModalStatus) {
        el.outputsModalStatus.textContent = `Failed to list outputs: ${e.message}`;
      }
    }
  }

  // Full SQLite History Database Modal Controller
  function buildHistoryQueryParams() {
    const params = new URLSearchParams();
    const q = el.historySearchInput ? el.historySearchInput.value.trim() : '';
    const model = el.historyModelFilterSelect ? el.historyModelFilterSelect.value : 'all';
    const status = el.historyStatusFilterSelect ? el.historyStatusFilterSelect.value : 'all';
    const typeChoice = el.historyTypeFilterSelect ? el.historyTypeFilterSelect.value : 'all';
    if (q) params.set('q', q);
    if (model && model !== 'all') params.set('model', model);
    if (status && status !== 'all') params.set('status', status);
    if (typeChoice === 'favorite') params.set('favorite', '1');
    else if (typeChoice && typeChoice !== 'all') params.set('type', typeChoice);
    params.set('limit', '150');
    return params;
  }

  async function reuseHistoryRun(item, onlyInputMedia = false) {
    if (!item) return;
    if (!onlyInputMedia && item.model_id && state.models.some(m => m.model_id === item.model_id)) {
      await selectModel(item.model_id, true);
    }

    const params = (item.parameters && typeof item.parameters === 'object') ? item.parameters : {};
    if (!onlyInputMedia) {
      if (item.prompt && el.promptInput) {
        el.promptInput.value = item.prompt;
      }
      if (params.negative_prompt !== undefined && el.negativePromptInput) {
        el.negativePromptInput.value = params.negative_prompt || '';
      }
      const resVal = params.resolution || params.target_resolution;
      if (resVal && el.resolutionSelect && Array.from(el.resolutionSelect.options).some(o => o.value === resVal)) {
        el.resolutionSelect.value = resVal;
      }
      if (params.duration !== undefined && el.durationSelect && Array.from(el.durationSelect.options).some(o => Number(o.value) === Number(params.duration))) {
        el.durationSelect.value = String(params.duration);
      }
      if (params.size && el.sizeSelect && Array.from(el.sizeSelect.options).some(o => o.value === params.size)) {
        el.sizeSelect.value = params.size;
      }
      if (params.quality !== undefined && el.qualitySelect && Array.from(el.qualitySelect.options).some(o => String(o.value) === String(params.quality))) {
        el.qualitySelect.value = String(params.quality);
      }
      if (params.num_images !== undefined && el.numImagesSelect && Array.from(el.numImagesSelect.options).some(o => Number(o.value) === Number(params.num_images))) {
        el.numImagesSelect.value = String(params.num_images);
      }
      if (params.output_format && el.outputFormatSelect && Array.from(el.outputFormatSelect.options).some(o => o.value === params.output_format)) {
        el.outputFormatSelect.value = params.output_format;
      }
      if (params.strength !== undefined && el.strengthSlider) {
        el.strengthSlider.value = String(params.strength);
        if (el.strengthValueLabel) el.strengthValueLabel.textContent = String(params.strength);
      }
      if (params.seed !== undefined && el.seedInput) {
        el.seedInput.value = String(params.seed);
      }
      if (params.aspect_ratio && el.ratioPills) {
        const pill = Array.from(el.ratioPills.querySelectorAll('.ratio-pill')).find(b => b.dataset.ratio === params.aspect_ratio);
        if (pill) {
          el.ratioPills.querySelectorAll('.ratio-pill').forEach(b => b.classList.remove('active'));
          pill.classList.add('active');
        }
      }
      if (el.audioCheckbox) {
        const savedAudioKey = AUDIO_SCHEMA_KEYS.find(k => params[k] !== undefined);
        if (savedAudioKey) {
          el.audioCheckbox.checked = Boolean(params[savedAudioKey]);
        }
      }
      if (state.selectedModel) updateModelInfo(state.selectedModel);
      showToast(`Loaded recipe from ${item.model_id || 'history'}`, 'good');
    }

    const imgInputUrl = item.input_image_url || params.image || (Array.isArray(params.images) ? params.images[0] : null);
    if (imgInputUrl) {
      state.sourceImage = { url: imgInputUrl, downloadUrl: imgInputUrl };
      if (el.imageUrlInput) el.imageUrlInput.value = imgInputUrl;
      if (el.imagePreview) el.imagePreview.src = imgInputUrl;
      if (el.imagePreviewContainer) el.imagePreviewContainer.style.display = 'flex';
      const dp = document.getElementById('dropzonePrompt');
      if (dp) dp.style.display = 'none';
    }

    const vidInputUrl = item.input_video_url || params.video;
    if (vidInputUrl && el.videoUrlInput) {
      state.sourceVideo = { url: vidInputUrl, downloadUrl: vidInputUrl };
      el.videoUrlInput.value = vidInputUrl;
      if (el.openSourceVideoTimelineBtn) el.openSourceVideoTimelineBtn.style.display = 'inline-flex';
    }

    const restoredRefVids = params.reference_videos || params.videos || params.ref_videos;
    if (Array.isArray(restoredRefVids) && restoredRefVids.length > 0) {
      state.refVideos = restoredRefVids.map((u, idx) => ({
        id: `rv-reuse-${Date.now()}-${idx}`,
        url: u,
        downloadUrl: u,
        previewUrl: u,
        name: u.split('/').pop() || `reference-video-${idx + 1}`,
        width: null,
        height: null,
        duration: null
      }));
      renderRefVideosList();
    }

    const restoredAuds = params.reference_audios || params.audios || (params.audio ? [params.audio] : []);
    if (Array.isArray(restoredAuds) && restoredAuds.length > 0) {
      state.refAudios = restoredAuds.map((u, idx) => ({
        id: `ra-reuse-${Date.now()}-${idx}`,
        url: u,
        downloadUrl: u,
        name: u.split('/').pop() || `reference-audio-${idx + 1}`,
        duration: null
      }));
      renderRefAudiosList();
    }

    if (el.historyDbModal) el.historyDbModal.style.display = 'none';
  }

  function renderHistoryDbModal(json) {
    if (!el.historyDbList) return;
    const stats = json?.stats || {};
    if (Array.isArray(json?.models)) {
      const mStats = new Map();
      json.models.forEach(m => mStats.set(m.model_id, m));
      state.historyModelStats = mStats;
      evaluatePreFlightSafety();
    }
    if (el.historyDbStatsBar) {
      const keepStr = (stats.cost_per_favorite !== null && stats.cost_per_favorite !== undefined)
        ? ` • 💎 Cost/Keep (⭐${stats.favorited_runs || 0}): $${Number(stats.cost_per_favorite).toFixed(4)}`
        : '';
      el.historyDbStatsBar.textContent =
        `Runs: ${stats.total_runs || 0} (✓ ${stats.completed_runs || 0} completed • ✕ ${stats.failed_runs || 0} failed/logged) • Videos: ${stats.total_videos || 0} • Images: ${stats.total_images || 0} • Est. Completed Spend: $${Number(stats.completed_spend || 0).toFixed(4)}${keepStr} • DB: studio_history.sqlite`;
    }

    if (el.historyModelFilterSelect && Array.isArray(json?.models)) {
      const prev = el.historyModelFilterSelect.value || 'all';
      el.historyModelFilterSelect.innerHTML = '<option value="all">All Models</option>';
      json.models.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.model_id;
        opt.textContent = `${m.model_id} (${m.run_count})`;
        el.historyModelFilterSelect.appendChild(opt);
      });
      if (Array.from(el.historyModelFilterSelect.options).some(o => o.value === prev)) {
        el.historyModelFilterSelect.value = prev;
      }
    }

    const items = Array.isArray(json?.items) ? json.items : [];
    el.historyDbList.innerHTML = '';
    if (items.length === 0) {
      el.historyDbList.innerHTML = '<div class="empty-gallery">No runs matched those filters in studio_history.sqlite.</div>';
      return;
    }

    items.forEach((item) => {
      const isOk = item.status === 'completed';
      const card = document.createElement('div');
      card.className = `history-db-card${isOk ? '' : ' status-failed'}`;

      const thumb = document.createElement('div');
      thumb.className = 'history-db-thumb';
      const outputSrc = (item.local_url && item.file_exists) ? item.local_url : (item.remote_url || '');
      if (outputSrc && isOk) {
        const media = document.createElement(item.is_video ? 'video' : 'img');
        if (item.is_video) {
          media.muted = true;
          media.preload = 'none';
        }
        media.src = outputSrc;
        media.onerror = () => {
          thumb.innerHTML = item.input_image_url ? `<img src="${escapeHtml(item.input_image_url)}" alt="Input">` : '<span>Preview N/A</span>';
        };
        thumb.appendChild(media);
      } else if (item.input_image_url) {
        const img = document.createElement('img');
        img.src = item.input_image_url;
        img.alt = 'Input image';
        img.onerror = () => { thumb.innerHTML = '<span>No Preview</span>'; };
        thumb.appendChild(img);
      } else {
        thumb.innerHTML = `<span>${isOk ? 'Saved' : escapeHtml(item.status)}</span>`;
      }

      const main = document.createElement('div');
      main.className = 'history-db-main';

      const metaBadges = [];
      if (item.resolution) metaBadges.push(item.resolution);
      if (item.duration) metaBadges.push(`${item.duration}s`);
      if (item.aspect_ratio) metaBadges.push(item.aspect_ratio);
      if (item.size) metaBadges.push(item.size);
      if (item.audio_enabled !== null && item.audio_enabled !== undefined) metaBadges.push(item.audio_enabled ? 'audio:ON' : 'audio:OFF');
      if (item.estimated_price !== null && item.estimated_price !== undefined) metaBadges.push(`$${Number(item.estimated_price).toFixed(4)}`);
      const when = item.completed_at || item.submitted_at;
      const whenText = when ? new Date(when).toLocaleString() : '';

      const top = document.createElement('div');
      top.className = 'history-db-top';
      top.innerHTML = `
        <span class="history-db-model">${item.is_favorite ? '⭐ ' : ''}${escapeHtml(item.model_id || 'unknown')}</span>
        <div class="history-db-badges">
          <span class="${isOk ? 'status-badge-ok' : 'status-badge-err'}">${escapeHtml(item.status)}</span>
          <span>${escapeHtml(metaBadges.join(' • '))}</span>
          ${whenText ? `<span style="color: var(--text-sub);">${escapeHtml(whenText)}</span>` : ''}
        </div>
      `;

      main.appendChild(top);

      if (item.prompt) {
        const pBox = document.createElement('div');
        pBox.className = 'history-db-prompt';
        pBox.textContent = item.prompt;
        main.appendChild(pBox);
      }

      if (item.error_message) {
        const eBox = document.createElement('div');
        eBox.className = 'history-db-error';
        eBox.textContent = `Error: ${item.error_message}`;
        main.appendChild(eBox);
      }

      const actions = document.createElement('div');
      actions.className = 'history-db-actions';

      if (isOk && (item.local_url || item.remote_url)) {
        const viewBtn = document.createElement('button');
        viewBtn.type = 'button';
        viewBtn.className = 'btn-action-tool';
        viewBtn.textContent = '👁️ View Output';
        viewBtn.addEventListener('click', () => {
          loadOutputIntoViewer({
            task_id: item.task_id,
            url: item.local_url || item.remote_url,
            local_url: item.local_url || null,
            remote_url: item.remote_url || null,
            local_path: item.local_path || null,
            isVideo: Boolean(item.is_video),
            model_id: item.model_id,
            prompt: item.prompt || '',
            price: item.estimated_price || 0,
            timestamp: item.completed_at || item.submitted_at
          });
          if (el.historyDbModal) el.historyDbModal.style.display = 'none';
        });
        actions.appendChild(viewBtn);
      }

      const reuseBtn = document.createElement('button');
      reuseBtn.type = 'button';
      reuseBtn.className = 'btn-action-tool';
      reuseBtn.textContent = '🔁 Reuse Setup';
      reuseBtn.addEventListener('click', () => reuseHistoryRun(item, false));
      actions.appendChild(reuseBtn);

      if (item.input_image_url) {
        const reuseImgBtn = document.createElement('button');
        reuseImgBtn.type = 'button';
        reuseImgBtn.className = 'btn-action-tool';
        reuseImgBtn.textContent = '🖼️ Reuse Input Image';
        reuseImgBtn.addEventListener('click', () => reuseHistoryRun(item, true));
        actions.appendChild(reuseImgBtn);
      }

      if (item.prompt) {
        const copyPromptBtn = document.createElement('button');
        copyPromptBtn.type = 'button';
        copyPromptBtn.className = 'btn-action-tool';
        copyPromptBtn.textContent = '📋 Copy Prompt';
        copyPromptBtn.addEventListener('click', async () => {
          const ok = await copyTextSafe(item.prompt);
          copyPromptBtn.textContent = ok ? '✓ Copied' : '📋 Copy Prompt';
          setTimeout(() => { copyPromptBtn.textContent = '📋 Copy Prompt'; }, 1500);
        });
        actions.appendChild(copyPromptBtn);
      }

      const favBtn = document.createElement('button');
      favBtn.type = 'button';
      favBtn.className = 'btn-action-tool';
      favBtn.textContent = item.is_favorite ? '★ Favorited' : '☆ Favorite';
      favBtn.addEventListener('click', async () => {
        const res = await fetch('/api/history/annotate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ task_id: item.task_id, is_favorite: !item.is_favorite })
        }).then(r => r.json()).catch(() => null);
        if (res && res.data) {
          fetchAndRenderHistoryDb();
        }
      });
      actions.appendChild(favBtn);

      main.appendChild(actions);
      card.appendChild(thumb);
      card.appendChild(main);
      el.historyDbList.appendChild(card);
    });
  }

  async function fetchAndRenderHistoryDb() {
    if (!el.historyDbModal) return;
    try {
      const qs = buildHistoryQueryParams().toString();
      const res = await fetch(`/api/history?${qs}`);
      const json = await res.json();
      renderHistoryDbModal(json);
    } catch (e) {
      if (el.historyDbStatsBar) el.historyDbStatsBar.textContent = `History DB error: ${e.message}`;
    }
  }

  function openHistoryDbModal() {
    if (!el.historyDbModal) return;
    el.historyDbModal.style.display = 'flex';
    fetchAndRenderHistoryDb();
  }

  // Inline Use-Case & Safety Advice Helper
  const USE_CASE_ADVISORY_MAP = [
    {
      match: 'wavespeed-ai/minimax-h3/image-to-video-spicy',
      tone: 'good',
      text: '🔥 Best Overall for Undressing & Explicit NSFW Video: Runs on WaveSpeed uncensored open-weights (no upstream safety block). At 480p with 50% OFF it costs only $0.02/s (10s = $0.20, 15s = $0.30).'
    },
    {
      match: 'wavespeed-ai/ltx-2.3-spicy/image-to-video',
      tone: 'good',
      text: '⏱️ Best for Longer Uncensored Clips (up to 20s): WaveSpeed open-weights engine ($0.02/s @ 480p -> 10s = $0.20, 20s = $0.40).'
    },
    {
      match: 'wavespeed-ai/wan-2.2-spicy/',
      tone: 'good',
      text: '🎬 Open-Weights Wan Spicy ($0.03/s @ 480p): Uncensored alternative when Wan 3.0 rejects sensitive inputs or when extending an existing video.'
    },
    {
      match: 'wavespeed-ai/wan-2.2/i2v-480p-ultra-fast',
      tone: 'good',
      text: '⚡ Ultra-Budget Motion Test ($0.01/s @ 480p -> $0.05 / 5s): Cheapest I2V motion check on open-weights Wan 2.2.'
    },
    {
      match: 'wavespeed-ai/qwen-image/edit',
      tone: 'good',
      text: '👗 Best Identity-Preserving Undress / Pose Edit (I2I): $0.02/edit. Dial in your exact frame in I2I first before spending $0.10-$0.20 animating it to video.'
    },
    {
      match: 'wavespeed-ai/z-image-turbo/image-to-image',
      tone: 'good',
      text: '💸 Ultra-Cheap I2I Iterations ($0.005/edit): Best for low-cost image restyling/undress drafts (~200 edits per $1).'
    },
    {
      match: 'wavespeed-ai/minimax-h3-image/edit',
      tone: 'good',
      text: '💎 WaveSpeed Open-Weights H3 Image Edit ($0.03 @ 1K): Cheaper than Official minimax/h3-image/edit ($0.038), adds 1.5K/3K tiers + seed control, and avoids official endpoint moderation.'
    },
    {
      match: 'wavespeed-ai/minimax-h3/image-edit',
      tone: 'good',
      text: '💎 WaveSpeed Open-Weights H3 Outfit/Identity Edit ($0.03 @ 1K): Same base cost as Economy H3 Edit but cheaper extra reference images ($0.005 each vs $0.01) up to 2K.'
    },
    {
      match: 'minimax/h3-image/edit',
      tone: 'warn',
      text: '🏢 Official MiniMax H3 Image Edit ($0.038 @ 1K/2K): Upstream MiniMax endpoint (supports up to 16 ref images, stricter moderation, costs +$0.008 more than wavespeed-ai/minimax-h3-image/edit).'
    },
    {
      match: 'alibaba/wan-3.0/video-edit',
      tone: 'warn',
      text: '🎬 Wan 3.0 Video Edit + Reference Images: 1) Upload Source Video (≤15s; longer clips trim automatically) · 2) Attach Reference Image(s) as Image 1 · 3) Describe the subject/scene replacement mentioning "Image 1" (480p is the lowest-cost tier). Note: upstream Wan endpoints still enforce safety moderation.'
    },
    {
      match: 'alibaba/wan-3.0/reference-to-video',
      tone: 'warn',
      text: '🧬 Wan 3.0 Reference-to-Video: Attach Reference Image(s) (Image 1...), Reference Video(s) (Video 1...), or Audio (Audio 1...) and refer to them in Prompt (480p is cheapest). Note: upstream Wan endpoints still enforce safety moderation.'
    },
    {
      match: '/video-edit',
      tone: 'good',
      text: '🎬 Video Edit + References: 1) Upload Source Video · 2) Attach Reference Image(s) (Image 1, Image 2...) · 3) Describe what to replace or preserve in the clip using "Image 1" (select 480p for lowest cost).'
    },
    {
      match: '/reference-to-video',
      tone: 'good',
      text: '🧬 Reference-to-Video (R2V): Attach Reference Image(s) (Image 1), Reference Video(s) (Video 1), or Audio (Audio 1), then reference them in Prompt. Lower resolution (480p) minimizes per-second cost.'
    },
    {
      match: 'alibaba/wan-3.0/',
      tone: 'warn',
      text: '⚠️ Upstream Moderation Caution: Even -spicy Wan 3.0 endpoints apply Alibaba safety filtering on certain images/acts AND cost $0.0475/s @ 480p. Prefer wavespeed-ai/minimax-h3/image-to-video-spicy ($0.02/s) or ltx-2.3-spicy ($0.02/s).'
    },
    {
      match: 'bytedance/seedance-2.5/',
      tone: 'warn',
      text: '💰 High-Burn Model Warning: Costs $0.81 per 5s clip at 480p. Save budget by prototyping with MiniMax H3 Spicy ($0.10/5s) or LTX 2.3 Spicy ($0.10/5s).'
    }
  ];

  function updateUseCaseAdvice(model) {
    if (!el.infoUseAdvice) return;
    const mid = (model?.model_id || '').toLowerCase();
    const hit = USE_CASE_ADVISORY_MAP.find(entry => mid.includes(entry.match));
    if (!hit) {
      el.infoUseAdvice.style.display = 'none';
      el.infoUseAdvice.textContent = '';
      return;
    }
    el.infoUseAdvice.className = `model-advice-banner ${hit.tone}`;
    el.infoUseAdvice.textContent = hit.text;
    el.infoUseAdvice.style.display = 'block';
  }

  // Best-For Advisor & Live I2I vs I2V Comparison Table
  const ADVISOR_ROWS = [
    {
      mode: 'I2I Edit',
      model_id: 'wavespeed-ai/z-image-turbo/image-to-image',
      isPerSec: false,
      note: 'Ultra-cheap I2I restyle / undress test drafts; lowest cost per try',
      caution: false
    },
    {
      mode: 'I2I Edit',
      model_id: 'wavespeed-ai/flux-2-klein-4b/edit',
      isPerSec: false,
      note: 'Fast instruction edit at ultra-low flat rate',
      caution: false
    },
    {
      mode: 'I2I Edit',
      model_id: 'wavespeed-ai/qwen-image/edit-plus',
      isPerSec: false,
      note: 'Best overall I2I for undressing, clothing swaps & preserving identity before I2V',
      caution: false
    },
    {
      mode: 'I2I Edit',
      model_id: 'wavespeed-ai/wan-2.2/image-to-image',
      isPerSec: false,
      note: 'Open-weights Wan 2.2 still image editing / anatomy consistency',
      caution: false
    },
    {
      mode: 'I2I Edit',
      model_id: 'wavespeed-ai/minimax-h3-image/edit',
      isPerSec: false,
      note: 'High-realism open-weights H3 still editing (1K tier)',
      caution: false
    },
    {
      mode: 'I2V Video',
      model_id: 'wavespeed-ai/wan-2.2/i2v-480p-ultra-fast',
      isPerSec: true,
      res: '480p',
      note: 'Cheapest open-weights 480p motion check (5s/8s clips)',
      caution: false
    },
    {
      mode: 'I2V Video 🔥',
      model_id: 'wavespeed-ai/minimax-h3/image-to-video-spicy',
      isPerSec: true,
      res: '480p',
      note: '#1 proven uncensored undressing & explicit sex actions (3-15s @ 480p, 50% OFF)',
      caution: false
    },
    {
      mode: 'I2V Video 🔥',
      model_id: 'wavespeed-ai/ltx-2.3-spicy/image-to-video',
      isPerSec: true,
      res: '480p',
      note: 'Best for long uncensored clips up to 20s @ 480p ($0.02/s)',
      caution: false
    },
    {
      mode: 'I2V Video 🔥',
      model_id: 'wavespeed-ai/wan-2.2-spicy/image-to-video',
      isPerSec: true,
      res: '480p',
      note: 'Open-weights Wan Spicy without Alibaba safety pre-check (5s/8s @ 480p)',
      caution: false
    },
    {
      mode: 'V2V Extend',
      model_id: 'wavespeed-ai/wan-2.2-spicy/video-extend',
      isPerSec: true,
      res: '480p',
      note: 'Continue/extend an existing good clip instead of regenerating from frame 1',
      caution: false
    },
    {
      mode: 'I2V Caution',
      model_id: 'alibaba/wan-3.0/image-to-video-spicy',
      isPerSec: true,
      res: '480p',
      note: '⚠️ 2.4x pricier + upstream safety blocks ("Content flagged as sensitive")',
      caution: true
    }
  ];

  function openAdvisorModal() {
    if (!el.advisorModal) return;
    renderAdvisorModal();
    el.advisorModal.style.display = 'flex';
  }

  function renderAdvisorModal() {
    if (!el.advisorComparisonBody || !el.advisorQuickPicks) return;
    const bal = state.balance > 0 ? state.balance : 3.62;
    if (el.advisorBudgetSummary) {
      const i2iDrafts = Math.floor((bal * 0.15) / 0.02);
      const h3Secs = Math.floor((bal * 0.85) / 0.02);
      el.advisorBudgetSummary.innerHTML =
        `<strong>Smart Strategy for Your $${bal.toFixed(4)} Balance:</strong> Do <strong>I2I First → I2V Second</strong>. ` +
        `Spend ~$${(bal * 0.15).toFixed(2)} on <strong>~${i2iDrafts}</strong> cheap I2I undress/pose drafts (` +
        `<code>qwen-image/edit-plus</code> $0.02 or <code>z-image-turbo</code> $0.005), then spend ~$${(bal * 0.85).toFixed(2)} animating the best keyframes on ` +
        `<code>minimax-h3/image-to-video-spicy</code> or <code>ltx-2.3-spicy</code> at <strong>480p ($0.02/s)</strong> = <strong>~${h3Secs} video seconds</strong> (about ${Math.floor(h3Secs / 10)} clips of 10s)!`;
    }

    const quickCards = [
      {
        title: '👗 Undressing Still (I2I)',
        modelId: 'wavespeed-ai/qwen-image/edit-plus',
        desc: '~$0.02/edit • Best face & body consistency for wardrobe removal before animating.'
      },
      {
        title: '🔥 Undress & Sex Video (I2V)',
        modelId: 'wavespeed-ai/minimax-h3/image-to-video-spicy',
        desc: '$0.02/s @ 480p (50% OFF) • Proven zero safety block on your images; 10s = $0.20.'
      },
      {
        title: '⏱️ Long Uncensored (up to 20s)',
        modelId: 'wavespeed-ai/ltx-2.3-spicy/image-to-video',
        desc: '$0.02/s @ 480p • WaveSpeed open-weights LTX Spicy for long explicit sequences.'
      },
      {
        title: '⚡ Ultra-Budget Drafts ($0.005)',
        modelId: 'wavespeed-ai/z-image-turbo/image-to-image',
        desc: '$0.005/run • Cheapest still restyle/undress tests (~200 runs per dollar).'
      }
    ];

    el.advisorQuickPicks.innerHTML = '';
    quickCards.forEach(c => {
      const card = document.createElement('div');
      card.className = 'advisor-pick-card';
      card.innerHTML = `
        <div class="advisor-pick-title">${escapeHtml(c.title)}</div>
        <div class="advisor-pick-sub"><code>${escapeHtml(c.modelId)}</code><br>${escapeHtml(c.desc)}</div>
      `;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn-action-tool';
      btn.textContent = '🎯 Select Model';
      btn.addEventListener('click', async () => {
        await selectModel(c.modelId, true);
        if (el.advisorModal) el.advisorModal.style.display = 'none';
      });
      card.appendChild(btn);
      el.advisorQuickPicks.appendChild(card);
    });

    el.advisorComparisonBody.innerHTML = '';
    ADVISOR_ROWS.forEach(row => {
      const model = state.models.find(m => m.model_id === row.model_id);
      let unitRate = model ? (getCatalogItemPricing(model).minRunCost) : 0;
      let rateLabel = '—';
      let affordsLabel = 'Not in catalog';
      if (model) {
        if (row.isPerSec) {
          const perSec = calculateModelCost(model, { duration: 1, resolution: row.res || '480p', generate_audio: false, sound: false }).finalPrice;
          const tenSec = calculateModelCost(model, { duration: 10, resolution: row.res || '480p', generate_audio: false, sound: false }).finalPrice;
          unitRate = perSec;
          rateLabel = `$${perSec}/s @ ${row.res || '480p'}<br><small style="color:var(--text-sub);">(5s=$${Number((perSec * 5).toFixed(4))})</small>`;
          const secsAvail = perSec > 0 ? Math.floor(bal / perSec) : 0;
          const clips10 = tenSec > 0 ? Math.floor(bal / tenSec) : 0;
          affordsLabel = `<strong>~${secsAvail}s total</strong><br><small style="color:var(--text-sub);">(${Math.floor(secsAvail / 5)} × 5s clips / ~${clips10} × 10s)</small>`;
        } else {
          const runCost = calculateModelCost(model, { resolution: '1k', quality: 'low', num_images: 1, images: ['img1'] }).finalPrice;
          unitRate = runCost;
          rateLabel = `$${runCost} / edit`;
          const runsAvail = runCost > 0 ? Math.floor(bal / runCost) : 0;
          affordsLabel = `<strong>~${runsAvail} edits</strong>`;
        }
      }

      const tr = document.createElement('tr');
      if (row.caution) tr.className = 'row-caution';
      tr.innerHTML = `
        <td>${escapeHtml(row.mode)}</td>
        <td><code>${escapeHtml(row.model_id)}</code></td>
        <td style="font-family:var(--font-mono);">${rateLabel}</td>
        <td>${affordsLabel}</td>
        <td>${escapeHtml(row.note)}</td>
      `;
      const actionTd = document.createElement('td');
      const useBtn = document.createElement('button');
      useBtn.type = 'button';
      useBtn.className = 'btn-action-tool';
      useBtn.textContent = row.caution ? 'Inspect' : 'Use';
      useBtn.disabled = !model;
      useBtn.addEventListener('click', async () => {
        await selectModel(row.model_id, true);
        if (el.advisorModal) el.advisorModal.style.display = 'none';
      });
      actionTd.appendChild(useBtn);
      tr.appendChild(actionTd);
      el.advisorComparisonBody.appendChild(tr);
    });
  }

  // History Management
  function loadLocalHistory() {
    try {
      const saved = localStorage.getItem('wavespeed_studio_history');
      if (saved) {
        state.history = JSON.parse(saved);
        renderHistory();
      }
    } catch (e) {
      state.history = [];
    }
  }

  function addToHistory(item) {
    state.history = state.history.filter(h =>
      !(item.task_id && h.task_id && h.task_id === item.task_id) &&
      !(item.local_path && h.local_path && h.local_path === item.local_path) &&
      !(item.local_url && (h.local_url === item.local_url || h.url === item.local_url)) &&
      !(item.remote_url && (h.remote_url === item.remote_url || h.url === item.remote_url))
    );
    state.history.unshift(item);
    if (state.history.length > 60) state.history.pop();
    try {
      localStorage.setItem('wavespeed_studio_history', JSON.stringify(state.history.slice(0, 40)));
    } catch (e) {}
    renderHistory();
  }

  function getItemCompareKey(item) {
    if (!item) return '';
    return String(item.task_id || item.local_path || item.local_url || item.url || item.remote_url || '');
  }

  function getFilteredHistoryItems() {
    if (state.galleryFilter === 'images') return state.history.filter(i => !i.isVideo);
    if (state.galleryFilter === 'videos') return state.history.filter(i => Boolean(i.isVideo));
    return state.history;
  }

  function updateCompareBadge() {
    if (!el.compareCountBadge) return;
    const n = state.compareKeys.length;
    el.compareCountBadge.textContent = n > 0 ? `(${n})` : '';
  }

  function toggleComparePin(item) {
    const key = getItemCompareKey(item);
    if (!key) return;
    const idx = state.compareKeys.indexOf(key);
    if (idx !== -1) {
      state.compareKeys.splice(idx, 1);
    } else {
      if (state.compareKeys.length >= 4) {
        state.compareKeys.shift();
      }
      state.compareKeys.push(key);
    }
    updateCompareBadge();
    renderHistory();
  }

  function openCompareModal() {
    if (!el.compareModal || !el.compareGrid) return;
    renderCompareModal();
    el.compareModal.style.display = 'flex';
  }

  function renderCompareModal() {
    if (!el.compareGrid) return;
    const pinnedItems = state.compareKeys
      .map(k => state.history.find(h => getItemCompareKey(h) === k))
      .filter(Boolean);
    const usingPinned = pinnedItems.length >= 2;
    const itemsToShow = usingPinned
      ? pinnedItems
      : getFilteredHistoryItems().slice(0, Math.min(4, getFilteredHistoryItems().length));

    if (el.compareSubtitle) {
      if (usingPinned) {
        el.compareSubtitle.textContent = `Comparing ${itemsToShow.length} pinned outputs side by side`;
      } else if (itemsToShow.length > 0) {
        el.compareSubtitle.textContent = `Showing latest ${itemsToShow.length} ${state.galleryFilter === 'all' ? '' : state.galleryFilter + ' '}outputs (pin 2–4 cards with ⚖️ for custom picks)`;
      } else {
        el.compareSubtitle.textContent = 'No outputs available to compare yet';
      }
    }

    el.compareGrid.innerHTML = '';
    const videoCount = itemsToShow.filter(i => i.isVideo).length;
    if (el.syncPlayCompareVideosBtn) {
      el.syncPlayCompareVideosBtn.style.display = videoCount >= 2 ? 'inline-flex' : 'none';
    }

    if (itemsToShow.length === 0) {
      el.compareGrid.innerHTML = '<div class="empty-gallery">Generate or load outputs first, then click ⚖️ Compare.</div>';
      return;
    }

    itemsToShow.forEach((item) => {
      const col = document.createElement('div');
      col.className = 'compare-col';
      const src = item.local_url || item.url || item.remote_url || '';

      const mediaWrap = document.createElement('div');
      mediaWrap.className = 'compare-media-wrap';
      if (item.isVideo) {
        const vid = document.createElement('video');
        vid.src = src;
        vid.controls = true;
        vid.playsInline = true;
        vid.loop = true;
        vid.preload = 'metadata';
        mediaWrap.appendChild(vid);
      } else {
        const img = document.createElement('img');
        img.src = src;
        img.alt = item.model_id || 'Compare output';
        mediaWrap.appendChild(img);
      }

      const modelDiv = document.createElement('div');
      modelDiv.className = 'compare-meta-model';
      modelDiv.textContent = item.model_id || 'model';

      const subDiv = document.createElement('div');
      subDiv.className = 'compare-meta-sub';
      const dateStr = item.timestamp ? new Date(item.timestamp).toLocaleString() : '';
      subDiv.textContent = `$${Number(item.price || 0).toFixed(4)}${dateStr ? ` • ${dateStr}` : ''}`;

      const promptDiv = document.createElement('div');
      promptDiv.className = 'compare-meta-prompt';
      promptDiv.textContent = item.prompt || '(No prompt recorded)';

      const actionsRow = document.createElement('div');
      actionsRow.style.display = 'flex';
      actionsRow.style.gap = '6px';
      actionsRow.style.marginTop = 'auto';

      const loadBtn = document.createElement('button');
      loadBtn.type = 'button';
      loadBtn.className = 'btn-action-tool';
      loadBtn.textContent = '👁️ View';
      loadBtn.addEventListener('click', () => {
        loadOutputIntoViewer(item);
        if (el.compareModal) el.compareModal.style.display = 'none';
      });
      actionsRow.appendChild(loadBtn);

      const key = getItemCompareKey(item);
      if (state.compareKeys.includes(key)) {
        const unpinBtn = document.createElement('button');
        unpinBtn.type = 'button';
        unpinBtn.className = 'btn-secondary-sm';
        unpinBtn.textContent = '✕ Unpin';
        unpinBtn.addEventListener('click', () => {
          state.compareKeys = state.compareKeys.filter(k => k !== key);
          updateCompareBadge();
          renderHistory();
          renderCompareModal();
        });
        actionsRow.appendChild(unpinBtn);
      }

      col.appendChild(mediaWrap);
      col.appendChild(modelDiv);
      col.appendChild(subDiv);
      col.appendChild(promptDiv);
      col.appendChild(actionsRow);
      el.compareGrid.appendChild(col);
    });
  }

  async function deleteHistoryOutput(item) {
    if (!item) return;
    const targetName = (item.local_path || item.local_url || item.model_id || 'this output').split(/[\\/]/).pop();
    const ok = window.confirm(`Delete "${targetName}" from disk and History DB? This cannot be undone.`);
    if (!ok) return;

    try {
      const res = await fetch('/api/outputs/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_id: item.task_id || null,
          local_path: item.local_path || null,
          local_url: item.local_url || null
        })
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        alert(`Delete failed: ${json.error || res.status}`);
        return;
      }

      const key = getItemCompareKey(item);
      state.compareKeys = state.compareKeys.filter(k => k !== key);
      state.history = state.history.filter(h => getItemCompareKey(h) !== key);
      try {
        localStorage.setItem('wavespeed_studio_history', JSON.stringify(state.history.slice(0, 40)));
      } catch (e) {}

      if (state.activeOutputItem && getItemCompareKey(state.activeOutputItem) === key) {
        state.activeOutputItem = null;
        if (el.localSaveBanner) el.localSaveBanner.style.display = 'none';
      }
      updateCompareBadge();
      renderHistory();
    } catch (e) {
      alert(`Delete failed: ${e.message}`);
    }
  }

  function loadCustomPromptChips() {
    try {
      const raw = localStorage.getItem('wavespeed_custom_prompt_chips');
      const parsed = raw ? JSON.parse(raw) : [];
      state.customPromptChips = Array.isArray(parsed)
        ? parsed.filter(c => c && typeof c.label === 'string' && typeof c.prompt === 'string')
        : [];
    } catch (e) {
      state.customPromptChips = [];
    }
  }

  function saveCustomPromptChips() {
    try {
      localStorage.setItem('wavespeed_custom_prompt_chips', JSON.stringify(state.customPromptChips));
    } catch (e) {}
  }

  function appendPromptSnippet(snippet) {
    if (!snippet || !el.promptInput) return;
    const current = el.promptInput.value.trim();
    el.promptInput.value = current ? `${current}, ${snippet}` : snippet;
    el.promptInput.focus();
  }

  function renderCustomPromptChips() {
    if (!el.customPromptChips) return;
    el.customPromptChips.innerHTML = '';
    state.customPromptChips.forEach((chip, idx) => {
      const wrap = document.createElement('span');
      wrap.className = 'custom-chip-wrap';

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chip-btn';
      btn.title = chip.prompt;
      btn.textContent = `📌 ${chip.label}`;
      btn.addEventListener('click', () => appendPromptSnippet(chip.prompt));

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'custom-chip-del';
      delBtn.title = 'Remove preset chip';
      delBtn.textContent = '×';
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        state.customPromptChips.splice(idx, 1);
        saveCustomPromptChips();
        renderCustomPromptChips();
      });

      wrap.appendChild(btn);
      wrap.appendChild(delBtn);
      el.customPromptChips.appendChild(wrap);
    });
  }

  function renderExtraImagesGrid() {
    if (!el.multiImgGrid) return;
    el.multiImgGrid.innerHTML = '';
    const hasSingleBefore = Boolean(el.imageInputGroup && el.imageInputGroup.style.display !== 'none');
    state.extraImages.forEach((entry, idx) => {
      const box = document.createElement('div');
      box.className = 'multi-img-thumb';
      const img = document.createElement('img');
      img.src = entry.previewUrl || entry.downloadUrl || '';
      img.alt = 'Reference image';

      const slotBadge = document.createElement('span');
      slotBadge.className = 'multi-img-badge';
      slotBadge.textContent = `Image ${hasSingleBefore ? idx + 2 : idx + 1}`;

      const rm = document.createElement('button');
      rm.type = 'button';
      rm.className = 'multi-img-remove';
      rm.title = 'Remove reference image';
      rm.textContent = '✕';
      rm.addEventListener('click', () => {
        state.extraImages = state.extraImages.filter(x => x.id !== entry.id);
        renderExtraImagesGrid();
        if (state.selectedModel) updateModelInfo(state.selectedModel);
      });

      box.appendChild(img);
      box.appendChild(slotBadge);
      box.appendChild(rm);
      el.multiImgGrid.appendChild(box);
    });
  }

  function addExtraImageFiles(fileList) {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList).slice(0, Math.max(0, 30 - state.extraImages.length));
    files.forEach((file) => {
      const id = `ref-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const entry = { id, file, previewUrl: '', downloadUrl: null };
      state.extraImages.push(entry);
      const reader = new FileReader();
      reader.onload = (ev) => {
        entry.previewUrl = ev.target.result;
        renderExtraImagesGrid();
      };
      reader.readAsDataURL(file);
    });
    renderExtraImagesGrid();
    if (state.selectedModel) updateModelInfo(state.selectedModel);
  }

  function addExtraImageUrl(url) {
    const clean = String(url || '').trim();
    if (!clean) return;
    const id = `ref-url-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    state.extraImages.push({ id, file: null, previewUrl: clean, downloadUrl: clean });
    renderExtraImagesGrid();
    if (state.selectedModel) updateModelInfo(state.selectedModel);
  }

  function handleLastImageFile(file) {
    if (!file) return;
    state.lastImage = { file };
    const reader = new FileReader();
    reader.onload = (e) => {
      if (el.lastImagePreview) el.lastImagePreview.src = e.target.result;
      if (el.lastImagePreviewContainer) el.lastImagePreviewContainer.style.display = 'flex';
      if (el.lastDropzonePrompt) el.lastDropzonePrompt.style.display = 'none';
    };
    reader.readAsDataURL(file);
  }

  function renderHistory() {
    updateCompareBadge();
    const filtered = getFilteredHistoryItems();
    if (state.history.length === 0) {
      el.historyGallery.innerHTML = '<div class="empty-gallery">No previous outputs in this session yet. All new generations are automatically saved to your local outputs folder.</div>';
      return;
    }
    if (filtered.length === 0) {
      el.historyGallery.innerHTML = `<div class="empty-gallery">No ${escapeHtml(state.galleryFilter)} found in current outputs. Switch filter back to All.</div>`;
      return;
    }

    el.historyGallery.innerHTML = '';
    const activeKey = state.activeOutputItem ? getItemCompareKey(state.activeOutputItem) : null;
    filtered.forEach((item) => {
      const itemKey = getItemCompareKey(item);
      const isPinned = state.compareKeys.includes(itemKey);
      const isViewing = Boolean(activeKey && activeKey === itemKey);
      const isBulkSelected = state.bulkSelectMode && state.bulkSelectedKeys.includes(itemKey);
      const card = document.createElement('div');
      card.className = `gallery-item${isPinned ? ' is-compare-pinned' : ''}${isViewing ? ' is-viewing' : ''}${isBulkSelected ? ' is-bulk-selected' : ''}`;
      const preferredUrl = item.local_url || item.url || item.remote_url || '';

      const thumbWrap = document.createElement('div');
      thumbWrap.className = 'gallery-thumb';

      if (state.bulkSelectMode) {
        const checkBox = document.createElement('div');
        checkBox.className = 'gallery-bulk-check';
        checkBox.textContent = isBulkSelected ? '✓' : '';
        card.appendChild(checkBox);
      }

      const cardActions = document.createElement('div');
      cardActions.className = 'gallery-card-actions';

      const reuseCardBtn = document.createElement('button');
      reuseCardBtn.type = 'button';
      reuseCardBtn.className = 'gallery-card-btn';
      reuseCardBtn.title = 'Clone exact model, prompt & settings';
      reuseCardBtn.textContent = '♻️';
      reuseCardBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        reuseHistoryRun(item, false);
      });

      const pinBtn = document.createElement('button');
      pinBtn.type = 'button';
      pinBtn.className = `gallery-card-btn${isPinned ? ' is-active' : ''}`;
      pinBtn.title = isPinned ? 'Remove from A/B Compare' : 'Pin for Side-by-Side A/B Compare';
      pinBtn.textContent = '⚖️';
      pinBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleComparePin(item);
      });

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'gallery-card-btn gallery-card-delete';
      delBtn.title = 'Delete file from disk and History DB';
      delBtn.textContent = '🗑️';
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteHistoryOutput(item);
      });

      cardActions.appendChild(reuseCardBtn);
      cardActions.appendChild(pinBtn);
      cardActions.appendChild(delBtn);

      const mediaEl = document.createElement(item.isVideo ? 'video' : 'img');
      if (item.isVideo) {
        mediaEl.muted = true;
        mediaEl.loop = true;
        mediaEl.preload = 'none';
        card.addEventListener('mouseenter', () => {
          const p = mediaEl.play();
          if (p && typeof p.catch === 'function') p.catch(() => {});
        });
        card.addEventListener('mouseleave', () => {
          mediaEl.pause();
          mediaEl.currentTime = 0;
        });
      } else {
        mediaEl.alt = 'Output thumbnail';
        mediaEl.loading = 'lazy';
      }
      let triedLocal = Boolean(item.local_url && preferredUrl === item.local_url);
      let triedRemote = Boolean(item.remote_url && preferredUrl === item.remote_url);
      mediaEl.src = preferredUrl;
      mediaEl.onerror = () => {
        if (item.local_url && !triedLocal) {
          triedLocal = true;
          mediaEl.src = item.local_url;
          return;
        }
        if (item.remote_url && !triedRemote) {
          triedRemote = true;
          mediaEl.src = item.remote_url;
          return;
        }
        thumbWrap.innerHTML = '<div class="gallery-thumb-fallback">Preview unavailable<br>(CDN expired)</div>';
      };
      thumbWrap.appendChild(mediaEl);

      if (item.isVideo) {
        const badge = document.createElement('span');
        badge.className = 'gallery-type-badge';
        badge.textContent = '▶ VIDEO';
        thumbWrap.appendChild(badge);
      }

      const metaDiv = document.createElement('div');
      metaDiv.className = 'gallery-meta';
      metaDiv.innerHTML = `
        <span class="gallery-model">${escapeHtml(item.model_id || 'model')}</span>
        <span class="gallery-price">$${item.price || 0}${item.local_path ? ' • 💾 Disk' : ''}</span>
      `;

      card.appendChild(thumbWrap);
      card.appendChild(cardActions);
      card.appendChild(metaDiv);
      card.addEventListener('click', () => {
        if (state.bulkSelectMode) {
          toggleBulkSelectKey(itemKey);
          return;
        }
        loadOutputIntoViewer(item);
      });
      el.historyGallery.appendChild(card);
    });
    updateBulkDeleteUi();
  }

  function loadOutputIntoViewer(item) {
    el.viewerPlaceholder.style.display = 'none';
    el.mediaContainer.style.display = 'flex';
    el.viewerActions.style.display = 'flex';
    state.activeOutputItem = item;

    const preferredUrl = item.local_url || item.url || item.remote_url || '';
    const remoteUrl = (item.remote_url && /^https?:\/\//i.test(item.remote_url) && !item.remote_url.includes('localhost'))
      ? item.remote_url
      : null;
    state.activeLocalUrl = item.local_url || (preferredUrl.startsWith('/outputs/') ? preferredUrl : null);
    state.activeRemoteUrl = remoteUrl;
    state.beforeAfterActive = false;
    if (el.beforeAfterStage) el.beforeAfterStage.style.display = 'none';
    if (el.beforeAfterToggleBtn) el.beforeAfterToggleBtn.classList.remove('is-active');

    if (item.isVideo) {
      el.outputImageViewer.style.display = 'none';
      el.outputVideoViewer.style.display = 'block';
      el.outputVideoViewer.controls = true;
      el.outputVideoViewer.playsInline = true;
      el.outputVideoViewer.onerror = () => {
        if (remoteUrl && el.outputVideoViewer.getAttribute('src') !== remoteUrl) {
          el.outputVideoViewer.src = remoteUrl;
          el.outputVideoViewer.load();
        }
      };
      el.outputVideoViewer.src = preferredUrl;
      el.outputVideoViewer.load();
      if (typeof el.outputVideoViewer.play === 'function') {
        const p = el.outputVideoViewer.play();
        if (p && typeof p.catch === 'function') p.catch(() => {});
      }
      if (el.grabFrameEditBtn) el.grabFrameEditBtn.style.display = 'flex';
      if (el.grabLastFrameI2VBtn) el.grabLastFrameI2VBtn.style.display = 'flex';
      if (el.openViewerTimelineBtn) el.openViewerTimelineBtn.style.display = 'flex';
      if (el.useOutputAsR2vBtn) el.useOutputAsR2vBtn.style.display = 'flex';
      if (el.useActiveRefVideoBtn) el.useActiveRefVideoBtn.style.display = 'inline-flex';
      if (el.loadActiveToTimelineBtn) el.loadActiveToTimelineBtn.style.display = 'inline-flex';
      if (el.beforeAfterToggleBtn) el.beforeAfterToggleBtn.style.display = 'none';
      if (el.extendVideoBtn) el.extendVideoBtn.style.display = 'flex';
      if (el.sendToVideoBtn) el.sendToVideoBtn.style.display = 'none';
      el.sendToEditBtn.style.display = 'none';
      if (el.fullscreenVideoBtn) el.fullscreenVideoBtn.style.display = 'flex';
    } else {
      if (typeof el.outputVideoViewer.pause === 'function') el.outputVideoViewer.pause();
      el.outputVideoViewer.removeAttribute('src');
      if (typeof el.outputVideoViewer.load === 'function') el.outputVideoViewer.load();
      el.outputVideoViewer.style.display = 'none';
      el.outputImageViewer.style.display = 'block';
      el.outputImageViewer.onerror = () => {
        if (remoteUrl && el.outputImageViewer.getAttribute('src') !== remoteUrl) {
          el.outputImageViewer.src = remoteUrl;
        }
      };
      el.outputImageViewer.src = preferredUrl;
      if (el.grabFrameEditBtn) el.grabFrameEditBtn.style.display = 'none';
      if (el.grabLastFrameI2VBtn) el.grabLastFrameI2VBtn.style.display = 'none';
      if (el.openViewerTimelineBtn) el.openViewerTimelineBtn.style.display = 'none';
      if (el.useOutputAsR2vBtn) el.useOutputAsR2vBtn.style.display = 'none';
      if (el.useActiveRefVideoBtn) el.useActiveRefVideoBtn.style.display = 'none';
      if (el.loadActiveToTimelineBtn) el.loadActiveToTimelineBtn.style.display = 'none';
      if (el.beforeAfterToggleBtn) {
        const beforeUrl = getBeforeImageForItem(item);
        el.beforeAfterToggleBtn.style.display = beforeUrl ? 'flex' : 'none';
      }
      if (el.extendVideoBtn) el.extendVideoBtn.style.display = 'none';
      if (el.sendToVideoBtn) el.sendToVideoBtn.style.display = 'flex';
      el.sendToEditBtn.style.display = 'flex';
      if (el.fullscreenVideoBtn) el.fullscreenVideoBtn.style.display = 'flex';
    }

    if (el.reuseActiveBtn) {
      el.reuseActiveBtn.style.display = (item.model_id || item.prompt) ? 'flex' : 'none';
    }

    updateViewerCostBadge(item.price);

    if (item.local_path) {
      state.activeLocalPath = item.local_path;
      if (el.showInFolderBtn) el.showInFolderBtn.style.display = 'flex';
      if (el.openContainingFolderBtn) el.openContainingFolderBtn.style.display = 'flex';
      renderLocalSaveBanner(item.local_path);
    } else {
      state.activeLocalPath = null;
      if (el.showInFolderBtn) el.showInFolderBtn.style.display = 'none';
      if (el.openContainingFolderBtn) el.openContainingFolderBtn.style.display = 'none';
      renderLocalSaveBanner(null);
    }
    syncGalleryActiveHighlight();
  }

  // Event Listeners
  function setupEventListeners() {
    // Mode Switcher Buttons: filter and select top model for tab
    el.modeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        el.modeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.currentCategory = btn.dataset.category;
        
        updatePlaceholderForCategory();

        // Automatically select the best top-pick model for this tab
        const catModels = state.models.filter(m => isModelInCategory(m, state.currentCategory));
        if (catModels.length > 0) {
          const topPick = catModels.find(m => m.isPinned) || catModels[0];
          selectModel(topPick.model_id, false);
        }

        filterAndRenderAutocomplete();
      });
    });

    // Combobox Input Events
    el.modelAutocompleteInput.addEventListener('focus', () => {
      openCombobox();
    });

    el.modelAutocompleteInput.addEventListener('input', () => {
      state.comboboxUserTyped = true;
      openCombobox();
    });

    el.modelAutocompleteInput.addEventListener('keydown', (e) => {
      const items = el.comboboxList.querySelectorAll('.combobox-item');
      if (items.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        openCombobox();
        state.comboboxActiveIndex = (state.comboboxActiveIndex + 1) % items.length;
        updateActiveComboboxItem(items);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        openCombobox();
        state.comboboxActiveIndex = (state.comboboxActiveIndex - 1 + items.length) % items.length;
        updateActiveComboboxItem(items);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (state.comboboxActiveIndex >= 0 && state.comboboxActiveIndex < state.filteredModels.length) {
          selectModel(state.filteredModels[state.comboboxActiveIndex].model_id);
          closeCombobox();
        }
      } else if (e.key === 'Escape') {
        closeCombobox();
      }
    });

    function updateActiveComboboxItem(items) {
      items.forEach((item, idx) => {
        const isActive = idx === state.comboboxActiveIndex;
        item.classList.toggle('active', isActive);
        if (isActive) item.scrollIntoView({ block: 'nearest' });
      });
    }

    // Toggle dropdown button
    el.comboboxToggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (el.comboboxDropdown.style.display === 'flex') {
        closeCombobox();
      } else {
        openCombobox();
        el.modelAutocompleteInput.focus();
      }
    });

    // Clear search input button
    el.comboboxClearBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      state.comboboxUserTyped = false;
      el.modelAutocompleteInput.value = '';
      el.comboboxClearBtn.style.display = 'none';
      openCombobox();
      el.modelAutocompleteInput.focus();
    });

    // Filter Chips inside combobox
    el.chipFilterBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        el.chipFilterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.comboboxFilter = btn.dataset.filter;
        filterAndRenderAutocomplete();
      });
    });

    // Click outside closes combobox
    document.addEventListener('click', (e) => {
      if (!el.modelCombobox.contains(e.target)) {
        closeCombobox();
      }
    });

    // Refresh Balance & Live Prices
    el.refreshBalanceBtn.addEventListener('click', syncLivePrices);
    if (el.syncPricesBtn) {
      el.syncPricesBtn.addEventListener('click', syncLivePrices);
    }
    if (el.openOutputsFolderBtn) {
      el.openOutputsFolderBtn.addEventListener('click', () => openOutputsFolder());
    }
    if (el.openOutputsHistoryBtn) {
      el.openOutputsHistoryBtn.addEventListener('click', () => openOutputsFolder());
    }
    if (el.showInFolderBtn) {
      el.showInFolderBtn.addEventListener('click', () => openOutputsFolder(state.activeLocalPath));
    }
    if (el.openContainingFolderBtn) {
      el.openContainingFolderBtn.addEventListener('click', () => openOutputsFolder(state.activeLocalPath, 'folder'));
    }
    if (el.closeOutputsModalBtn && el.outputsModal) {
      el.closeOutputsModalBtn.addEventListener('click', () => {
        el.outputsModal.style.display = 'none';
      });
      el.outputsModal.addEventListener('click', (e) => {
        if (e.target === el.outputsModal) el.outputsModal.style.display = 'none';
      });
    }
    if (el.copyOutputsPathBtn) {
      el.copyOutputsPathBtn.addEventListener('click', async () => {
        const pathToCopy = el.outputsFolderPathCode?.textContent?.trim() || state.outputsDir || './outputs';
        const ok = await copyTextSafe(pathToCopy);
        el.copyOutputsPathBtn.textContent = ok ? '✓ Copied!' : '📋 Copy Path';
        if (el.outputsModalStatus) {
          el.outputsModalStatus.textContent = ok
            ? `Copied "${pathToCopy}" — press Win+R, paste (Ctrl+V), and hit Enter to open in Windows Explorer.`
            : `Path: ${pathToCopy}`;
        }
        setTimeout(() => { el.copyOutputsPathBtn.textContent = '📋 Copy Path'; }, 1800);
      });
    }
    if (el.retryExplorerBtn) {
      el.retryExplorerBtn.addEventListener('click', async () => {
        const res = await requestNativeExplorer(state.lastRequestedOutputPath || null, 'folder').catch(() => null);
        if (el.outputsModalStatus) {
          el.outputsModalStatus.textContent = res?.explorer_launched
            ? `Requested containing folder "${res.folder || res.opened}".`
            : 'Explorer request failed.';
        }
      });
    }

    // Aspect Ratio Buttons
    el.ratioPills.addEventListener('click', (e) => {
      const btn = e.target.closest('.ratio-pill');
      if (btn) {
        document.querySelectorAll('.ratio-pill').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
      }
    });

    // Strength Slider Label
    el.strengthSlider.addEventListener('input', (e) => {
      el.strengthValueLabel.textContent = parseFloat(e.target.value).toFixed(2);
    });

    // Randomize Seed
    el.randomizeSeedBtn.addEventListener('click', () => {
      el.seedInput.value = Math.floor(Math.random() * 10000000);
    });

    // Dynamic price recalculation on parameter adjustment
    if (el.resolutionSelect) {
      el.resolutionSelect.addEventListener('change', () => {
        updateInputQualityAdvisory();
        if (state.selectedModel) updateModelInfo(state.selectedModel);
      });
    }

    if (el.durationSelect) {
      el.durationSelect.addEventListener('change', () => {
        if (state.selectedModel) updateModelInfo(state.selectedModel);
      });
    }

    if (el.sizeSelect) {
      el.sizeSelect.addEventListener('change', () => {
        if (state.selectedModel) updateModelInfo(state.selectedModel);
      });
    }

    if (el.qualitySelect) {
      el.qualitySelect.addEventListener('change', () => {
        if (state.selectedModel) updateModelInfo(state.selectedModel);
      });
    }

    if (el.numImagesSelect) {
      el.numImagesSelect.addEventListener('change', () => {
        if (state.selectedModel) updateModelInfo(state.selectedModel);
      });
    }

    if (el.audioCheckbox) {
      el.audioCheckbox.addEventListener('change', () => {
        if (state.selectedModel) updateModelInfo(state.selectedModel);
      });
    }

    if (el.outputFormatSelect) {
      el.outputFormatSelect.addEventListener('change', () => {
        if (state.selectedModel) updateModelInfo(state.selectedModel);
      });
    }

    // Built-in Prompt Chips
    document.querySelectorAll('.chip-btn[data-add]').forEach(chip => {
      chip.addEventListener('click', () => {
        appendPromptSnippet(chip.dataset.add);
      });
    });

    // Custom Saved Prompt Preset Chips
    if (el.savePresetChipBtn && el.customChipCreator) {
      el.savePresetChipBtn.addEventListener('click', () => {
        const promptText = el.promptInput ? el.promptInput.value.trim() : '';
        if (!promptText) {
          alert('Enter a prompt first before saving it as a reusable chip.');
          if (el.promptInput) el.promptInput.focus();
          return;
        }
        el.customChipCreator.style.display = 'flex';
        if (el.customChipLabelInput) {
          el.customChipLabelInput.value = '';
          el.customChipLabelInput.focus();
        }
      });
    }
    if (el.cancelSaveChipBtn && el.customChipCreator) {
      el.cancelSaveChipBtn.addEventListener('click', () => {
        el.customChipCreator.style.display = 'none';
      });
    }
    if (el.confirmSaveChipBtn && el.customChipCreator) {
      const doSaveCustomChip = () => {
        const label = (el.customChipLabelInput?.value || '').trim();
        const promptText = (el.promptInput?.value || '').trim();
        if (!label) {
          alert('Enter a short label for the preset chip.');
          if (el.customChipLabelInput) el.customChipLabelInput.focus();
          return;
        }
        if (!promptText) {
          alert('Prompt text cannot be empty.');
          return;
        }
        state.customPromptChips.push({ label, prompt: promptText });
        saveCustomPromptChips();
        renderCustomPromptChips();
        el.customChipCreator.style.display = 'none';
        if (el.customChipLabelInput) el.customChipLabelInput.value = '';
      };
      el.confirmSaveChipBtn.addEventListener('click', doSaveCustomChip);
      if (el.customChipLabelInput) {
        el.customChipLabelInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            doSaveCustomChip();
          } else if (e.key === 'Escape') {
            el.customChipCreator.style.display = 'none';
          }
        });
      }
    }

    // Image Upload & Dropzone
    el.imageDropzone.addEventListener('click', () => el.imageFileInput.click());
    el.imageDropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      el.imageDropzone.classList.add('dragover');
    });
    el.imageDropzone.addEventListener('dragleave', () => {
      el.imageDropzone.classList.remove('dragover');
    });
    el.imageDropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      el.imageDropzone.classList.remove('dragover');
      if (e.dataTransfer.files.length > 0) {
        handleImageFile(e.dataTransfer.files[0]);
      }
    });

    el.imageFileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        handleImageFile(e.target.files[0]);
      }
    });

    el.removeImageBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      state.sourceImage = null;
      state.sourceImageDimensions = null;
      el.imagePreview.src = '';
      el.imagePreviewContainer.style.display = 'none';
      document.getElementById('dropzonePrompt').style.display = 'block';
      updateInputQualityAdvisory();
      if (state.selectedModel) updateModelInfo(state.selectedModel);
    });

    // Load Image via URL
      el.loadUrlBtn.addEventListener('click', () => {
        const url = el.imageUrlInput.value.trim();
        if (url) {
          state.sourceImage = { url, downloadUrl: url };
          state.sourceImageDimensions = null;
          el.imagePreview.onload = () => {
            if (el.imagePreview.naturalWidth && el.imagePreview.naturalHeight) {
              state.sourceImageDimensions = {
                width: el.imagePreview.naturalWidth,
                height: el.imagePreview.naturalHeight
              };
              updateInputQualityAdvisory();
            }
          };
          el.imagePreview.src = url;
          el.imagePreviewContainer.style.display = 'flex';
          document.getElementById('dropzonePrompt').style.display = 'none';
          if (state.selectedModel) updateModelInfo(state.selectedModel);
        }
      });
      el.imageUrlInput.addEventListener('change', () => {
        if (state.selectedModel) updateModelInfo(state.selectedModel);
      });

    // Optional End Frame (Last Image) Dropzone & URL
    if (el.lastImageDropzone && el.lastImageFileInput) {
      el.lastImageDropzone.addEventListener('click', () => el.lastImageFileInput.click());
      el.lastImageDropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        el.lastImageDropzone.classList.add('dragover');
      });
      el.lastImageDropzone.addEventListener('dragleave', () => {
        el.lastImageDropzone.classList.remove('dragover');
      });
      el.lastImageDropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        el.lastImageDropzone.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) handleLastImageFile(e.dataTransfer.files[0]);
      });
      el.lastImageFileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) handleLastImageFile(e.target.files[0]);
      });
    }
    if (el.removeLastImageBtn) {
      el.removeLastImageBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        state.lastImage = null;
        if (el.lastImagePreview) el.lastImagePreview.src = '';
        if (el.lastImagePreviewContainer) el.lastImagePreviewContainer.style.display = 'none';
        if (el.lastDropzonePrompt) el.lastDropzonePrompt.style.display = 'block';
        if (el.lastImageUrlInput) el.lastImageUrlInput.value = '';
      });
    }
    if (el.loadLastUrlBtn && el.lastImageUrlInput) {
      el.loadLastUrlBtn.addEventListener('click', () => {
        const url = el.lastImageUrlInput.value.trim();
        if (url) {
          state.lastImage = { url, downloadUrl: url };
          if (el.lastImagePreview) el.lastImagePreview.src = url;
          if (el.lastImagePreviewContainer) el.lastImagePreviewContainer.style.display = 'flex';
          if (el.lastDropzonePrompt) el.lastDropzonePrompt.style.display = 'none';
        }
      });
    }

    // Multi-Reference Additional Images (Files + URL + Drag-and-Drop)
    if (el.addMoreImagesBtn && el.multiFileInput) {
      el.addMoreImagesBtn.addEventListener('click', () => el.multiFileInput.click());
      el.multiFileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
          addExtraImageFiles(e.target.files);
          e.target.value = '';
        }
      });
    }
    if (el.multiImageGroup) {
      el.multiImageGroup.addEventListener('dragover', (e) => {
        e.preventDefault();
        el.multiImageGroup.classList.add('dragover');
      });
      el.multiImageGroup.addEventListener('dragleave', () => {
        el.multiImageGroup.classList.remove('dragover');
      });
      el.multiImageGroup.addEventListener('drop', (e) => {
        e.preventDefault();
        el.multiImageGroup.classList.remove('dragover');
        if (e.dataTransfer?.files?.length > 0) {
          addExtraImageFiles(e.dataTransfer.files);
        }
      });
    }
    if (el.addMultiImageUrlBtn && el.multiImageUrlInput) {
      el.addMultiImageUrlBtn.addEventListener('click', () => {
        const u = el.multiImageUrlInput.value.trim();
        if (u) {
          addExtraImageUrl(u);
          el.multiImageUrlInput.value = '';
        }
      });
    }

    // Source Video Upload & Duration/Resolution Probing (for Video Edit / Extend / Upscalers)
    const handleSourceVideoFile = (file) => {
      if (!file) return;
      state.sourceVideo = { file };
      state.sourceVideoDimensions = null;
      el.videoDropzone.querySelector('p').textContent = `Loaded: ${file.name}`;
      if (el.openSourceVideoTimelineBtn) el.openSourceVideoTimelineBtn.style.display = 'inline-flex';
      if (el.clearSourceVideoBtn) el.clearSourceVideoBtn.style.display = 'inline-flex';
      probeVideoFileMeta(file, (meta) => {
        if (meta.duration) state.sourceVideoDuration = Math.ceil(meta.duration);
        if (meta.width && meta.height) state.sourceVideoDimensions = { width: meta.width, height: meta.height };
        updateInputQualityAdvisory();
        if (state.selectedModel) updateModelInfo(state.selectedModel);
      });
    };
    el.videoDropzone.addEventListener('click', () => el.videoFileInput.click());
    el.videoDropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      el.videoDropzone.classList.add('dragover');
    });
    el.videoDropzone.addEventListener('dragleave', () => {
      el.videoDropzone.classList.remove('dragover');
    });
    el.videoDropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      el.videoDropzone.classList.remove('dragover');
      if (e.dataTransfer?.files?.length > 0) {
        handleSourceVideoFile(e.dataTransfer.files[0]);
      }
    });
    el.videoFileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        handleSourceVideoFile(e.target.files[0]);
      }
    });
    if (el.videoUrlInput) {
      el.videoUrlInput.addEventListener('change', () => {
        const vUrl = el.videoUrlInput.value.trim();
        if (vUrl) {
          if (el.openSourceVideoTimelineBtn) el.openSourceVideoTimelineBtn.style.display = 'inline-flex';
          if (el.clearSourceVideoBtn) el.clearSourceVideoBtn.style.display = 'inline-flex';
          probeVideoUrlMeta(vUrl, (meta) => {
            if (meta.duration) state.sourceVideoDuration = Math.ceil(meta.duration);
            if (meta.width && meta.height) state.sourceVideoDimensions = { width: meta.width, height: meta.height };
            updateInputQualityAdvisory();
            if (state.selectedModel) updateModelInfo(state.selectedModel);
          });
        } else {
          state.sourceVideo = null;
          state.sourceVideoDuration = null;
          state.sourceVideoDimensions = null;
          if (el.openSourceVideoTimelineBtn) el.openSourceVideoTimelineBtn.style.display = 'none';
          if (el.clearSourceVideoBtn) el.clearSourceVideoBtn.style.display = 'none';
          updateInputQualityAdvisory();
          if (state.selectedModel) updateModelInfo(state.selectedModel);
        }
      });
    }
    if (el.clearSourceVideoBtn) {
      el.clearSourceVideoBtn.addEventListener('click', () => {
        state.sourceVideo = null;
        state.sourceVideoDuration = null;
        state.sourceVideoDimensions = null;
        if (el.videoUrlInput) el.videoUrlInput.value = '';
        if (el.videoFileInput) el.videoFileInput.value = '';
        const dpP = el.videoDropzone?.querySelector('p');
        if (dpP) dpP.textContent = 'Click or drag video file here';
        if (el.openSourceVideoTimelineBtn) el.openSourceVideoTimelineBtn.style.display = 'none';
        el.clearSourceVideoBtn.style.display = 'none';
        updateInputQualityAdvisory();
        if (state.selectedModel) updateModelInfo(state.selectedModel);
      });
    }
    if (el.openSourceVideoTimelineBtn) {
      el.openSourceVideoTimelineBtn.addEventListener('click', () => {
        const src = state.sourceVideo?.file || state.sourceVideo?.downloadUrl || state.sourceVideo?.url || el.videoUrlInput?.value.trim();
        if (src) openVideoInTimeline(src, state.sourceVideo?.file?.name || 'Source Video');
      });
    }

    // Reference Videos Self-Upload, Drag-Drop & URL List (R2V)
    if (el.refVideoDropzone && el.refVideoFileInput) {
      el.refVideoDropzone.addEventListener('click', () => el.refVideoFileInput.click());
      el.refVideoDropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        el.refVideoDropzone.classList.add('dragover');
      });
      el.refVideoDropzone.addEventListener('dragleave', () => {
        el.refVideoDropzone.classList.remove('dragover');
      });
      el.refVideoDropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        el.refVideoDropzone.classList.remove('dragover');
        if (e.dataTransfer?.files?.length > 0) addRefVideoFiles(e.dataTransfer.files);
      });
      el.refVideoFileInput.addEventListener('change', (e) => {
        if (e.target.files?.length > 0) {
          addRefVideoFiles(e.target.files);
          e.target.value = '';
        }
      });
    }
    if (el.addRefVideoUrlBtn && el.refVideoUrlInput) {
      el.addRefVideoUrlBtn.addEventListener('click', () => {
        const u = el.refVideoUrlInput.value.trim();
        if (u) {
          addRefVideoUrl(u);
          el.refVideoUrlInput.value = '';
        }
      });
    }
    if (el.useActiveRefVideoBtn) {
      el.useActiveRefVideoBtn.addEventListener('click', () => {
        const activeVid = state.activeOutputItem?.isVideo ? (state.activeOutputItem.local_url || state.activeOutputItem.remote_url || state.activeOutputItem.url) : '';
        if (activeVid) addRefVideoUrl(activeVid, 'Active Output Clip');
      });
    }

    // Reference Audios Self-Upload & URL List (R2V / Video Edit)
    if (el.uploadRefAudioBtn && el.refAudioFileInput) {
      el.uploadRefAudioBtn.addEventListener('click', () => el.refAudioFileInput.click());
      el.refAudioFileInput.addEventListener('change', (e) => {
        if (e.target.files?.length > 0) {
          addRefAudioFiles(e.target.files);
          e.target.value = '';
        }
      });
    }
    if (el.addRefAudioUrlBtn && el.refAudioUrlInput) {
      el.addRefAudioUrlBtn.addEventListener('click', () => {
        const u = el.refAudioUrlInput.value.trim();
        if (u) {
          addRefAudioUrl(u);
          el.refAudioUrlInput.value = '';
        }
      });
    }

    // Interactive Video Timeline & Frame Extractor
    if (el.toggleTimelineExtractorBtn && el.timelineExtractorBody) {
      el.toggleTimelineExtractorBtn.addEventListener('click', () => {
        const isOpen = el.timelineExtractorBody.style.display !== 'none';
        el.timelineExtractorBody.style.display = isOpen ? 'none' : 'flex';
        el.toggleTimelineExtractorBtn.setAttribute('aria-expanded', String(!isOpen));
        if (el.timelineChevron) el.timelineChevron.textContent = isOpen ? '▼' : '▲';
      });
    }
    if (el.browseTimelineVideoBtn && el.timelineVideoFileInput) {
      el.browseTimelineVideoBtn.addEventListener('click', () => el.timelineVideoFileInput.click());
      el.timelineVideoFileInput.addEventListener('change', (e) => {
        if (e.target.files?.length > 0) {
          openVideoInTimeline(e.target.files[0], e.target.files[0].name);
          e.target.value = '';
        }
      });
    }
    if (el.loadActiveToTimelineBtn) {
      el.loadActiveToTimelineBtn.addEventListener('click', () => {
        const activeVid = state.activeOutputItem?.isVideo
          ? (state.activeOutputItem.local_url || state.activeOutputItem.remote_url || state.activeOutputItem.url)
          : '';
        if (activeVid) openVideoInTimeline(activeVid, 'Active Output Video');
      });
    }
    if (el.timelineVideoPlayer && el.timelineScrubber) {
      let pendingSeekSec = null;
      let seekRafId = null;
      let seekBusy = false;

      const pumpTimelineSeek = (exact = false) => {
        const v = el.timelineVideoPlayer;
        if (!v || pendingSeekSec === null) return;
        const target = pendingSeekSec;
        if (seekBusy && !exact) return;
        seekBusy = true;
        pendingSeekSec = null;
        if (!exact && typeof v.fastSeek === 'function') {
          try { v.fastSeek(target); } catch (e) { v.currentTime = target; }
        } else {
          v.currentTime = target;
        }
      };

      el.timelineScrubber.addEventListener('input', () => {
        const v = el.timelineVideoPlayer;
        const dur = v.duration;
        if (Number.isFinite(dur) && dur > 0) {
          v.pause();
          const targetSec = (Number(el.timelineScrubber.value) / 1000) * dur;
          if (el.timelineTimecode) {
            el.timelineTimecode.textContent = `${formatTimecode(targetSec)} / ${formatTimecode(dur)}`;
          }
          pendingSeekSec = targetSec;
          if (!seekRafId) {
            seekRafId = window.requestAnimationFrame(() => {
              seekRafId = null;
              pumpTimelineSeek(false);
            });
          }
        }
      });
      el.timelineScrubber.addEventListener('change', () => {
        const v = el.timelineVideoPlayer;
        const dur = v.duration;
        if (Number.isFinite(dur) && dur > 0) {
          pendingSeekSec = (Number(el.timelineScrubber.value) / 1000) * dur;
          pumpTimelineSeek(true);
        }
      });
      el.timelineVideoPlayer.addEventListener('seeked', () => {
        seekBusy = false;
        syncTimelineTimecodeUI();
        if (pendingSeekSec !== null) {
          pumpTimelineSeek(false);
        }
      });
      el.timelineVideoPlayer.addEventListener('timeupdate', syncTimelineTimecodeUI);
    }
    const stepTimeline = (deltaSec, absPos = null) => {
      const v = el.timelineVideoPlayer;
      if (!v || !Number.isFinite(v.duration) || v.duration <= 0) return;
      v.pause();
      if (absPos === 'start') v.currentTime = 0;
      else if (absPos === 'end') v.currentTime = Math.max(0, v.duration - 0.04);
      else v.currentTime = Math.max(0, Math.min(v.duration, (v.currentTime || 0) + deltaSec));
      syncTimelineTimecodeUI();
    };
    if (el.tlStepStartBtn) el.tlStepStartBtn.addEventListener('click', () => stepTimeline(0, 'start'));
    if (el.tlStepBack1sBtn) el.tlStepBack1sBtn.addEventListener('click', () => stepTimeline(-1));
    if (el.tlStepBack1fBtn) el.tlStepBack1fBtn.addEventListener('click', () => stepTimeline(-1 / 24));
    if (el.tlStepFwd1fBtn) el.tlStepFwd1fBtn.addEventListener('click', () => stepTimeline(1 / 24));
    if (el.tlStepFwd1sBtn) el.tlStepFwd1sBtn.addEventListener('click', () => stepTimeline(1));
    if (el.tlStepEndBtn) el.tlStepEndBtn.addEventListener('click', () => stepTimeline(0, 'end'));
    if (el.extractFrameSourceBtn) el.extractFrameSourceBtn.addEventListener('click', () => extractTimelineFrame('source'));
    if (el.extractFrameLastBtn) el.extractFrameLastBtn.addEventListener('click', () => extractTimelineFrame('last'));
    if (el.extractFrameRefBtn) el.extractFrameRefBtn.addEventListener('click', () => extractTimelineFrame('ref'));
    if (el.tlSetTrimStartBtn) {
      el.tlSetTrimStartBtn.addEventListener('click', () => {
        const t = Number(el.timelineVideoPlayer?.currentTime || 0);
        state.trimStartSec = Math.max(0, t);
        if (state.trimEndSec <= state.trimStartSec + 0.1) {
          const maxD = Number(el.timelineVideoPlayer?.duration || 15);
          state.trimEndSec = Math.min(maxD, state.trimStartSec + 5);
        }
        syncTrimLabelsUI();
      });
    }
    if (el.tlSetTrimEndBtn) {
      el.tlSetTrimEndBtn.addEventListener('click', () => {
        const t = Number(el.timelineVideoPlayer?.currentTime || 0);
        state.trimEndSec = Math.max(state.trimStartSec + 0.2, t);
        syncTrimLabelsUI();
      });
    }
    if (el.tlRunTrimBtn) {
      el.tlRunTrimBtn.addEventListener('click', () => runTimelineLocalTrim());
    }
    if (el.batchSeedsSelect) {
      el.batchSeedsSelect.addEventListener('change', () => {
        if (state.selectedModel) updateModelInfo(state.selectedModel);
      });
    }
    if (el.bulkStitchSelectedBtn) {
      el.bulkStitchSelectedBtn.addEventListener('click', () => executeBulkStitch());
    }

    if (el.preUpscaleCheckbox) {
      el.preUpscaleCheckbox.addEventListener('change', () => {
        if (state.selectedModel) updateModelInfo(state.selectedModel);
      });
    }
    if (el.routeToVideoUpscalerBtn) {
      el.routeToVideoUpscalerBtn.addEventListener('click', routeVideoToUpscaler);
    }
    if (el.openViewerTimelineBtn) {
      el.openViewerTimelineBtn.addEventListener('click', () => {
        const activeVid = state.activeOutputItem?.isVideo
          ? (state.activeOutputItem.local_url || state.activeOutputItem.remote_url || state.activeOutputItem.url)
          : '';
        if (activeVid) openVideoInTimeline(activeVid, 'Active Output Video');
      });
    }
    if (el.useOutputAsR2vBtn) {
      el.useOutputAsR2vBtn.addEventListener('click', async () => {
        const activeVid = state.activeOutputItem?.isVideo
          ? (state.activeOutputItem.local_url || state.activeOutputItem.remote_url || state.activeOutputItem.url)
          : '';
        if (!activeVid) return;
        const r2vTab = document.querySelector('.mode-btn[data-category="ref-to-video"]');
        if (r2vTab) r2vTab.click();
        addRefVideoUrl(activeVid, 'Active Output Clip');
        showToast('Attached active output as Video 1 in Ref → Video', 'good');
      });
    }

    // Clear Canvas Mask
    el.clearMaskBtn.addEventListener('click', clearMask);

    // Big Generate / Run Button
    el.generateBtn.addEventListener('click', runGeneration);

    // Clear / Stop Active Jobs
    el.cancelTaskBtn.addEventListener('click', () => {
      resetExecutionState();
      if (state.selectedModel) updateModelInfo(state.selectedModel);
    });

    // Native Fullscreen Toggle (Video or Image)
    if (el.fullscreenVideoBtn) {
      el.fullscreenVideoBtn.addEventListener('click', () => {
        const isImg = el.outputImageViewer && el.outputImageViewer.style.display !== 'none';
        const target = isImg ? el.outputImageViewer : el.outputVideoViewer;
        if (!target) return;
        if (target.requestFullscreen) target.requestFullscreen().catch(() => {});
        else if (target.webkitRequestFullscreen) target.webkitRequestFullscreen();
        else if (target.msRequestFullscreen) target.msRequestFullscreen();
      });
    }

    // Extend Video Button (Load active clip into Video Extend model)
    if (el.extendVideoBtn) {
      el.extendVideoBtn.addEventListener('click', () => {
        const currentVidUrl = state.activeOutputItem?.remote_url
          || state.activeOutputItem?.local_url
          || state.activeRemoteUrl
          || state.activeLocalUrl
          || el.outputVideoViewer.src;
        if (!currentVidUrl) return;

        const videoTabBtn = document.querySelector('.mode-btn[data-category="video-gen"]');
        if (videoTabBtn) videoTabBtn.click();

        const extendCandidates = [
          'wavespeed-ai/wan-2.2-spicy/video-extend',
          'wavespeed-ai/minimax-h3/video-extend'
        ];
        const chosenExtend = extendCandidates.find(id => state.models.some(m => m.model_id === id))
          || state.models.find(m => (m.model_id || '').includes('video-extend'))?.model_id;
        if (chosenExtend) {
          selectModel(chosenExtend, true);
        }

        state.sourceVideo = { url: currentVidUrl, downloadUrl: currentVidUrl };
        if (el.videoUrlInput) {
          el.videoUrlInput.value = currentVidUrl;
          el.videoUrlInput.dispatchEvent(new Event('change'));
        }
        if (el.videoDropzone) {
          const p = el.videoDropzone.querySelector('p');
          if (p) p.textContent = 'Loaded active output video ready to extend';
        }
      });
    }

    // Send to Video Button (Animate Still Image)
    if (el.sendToVideoBtn) {
      el.sendToVideoBtn.addEventListener('click', () => {
        const currentImgUrl = el.outputImageViewer.src;
        if (!currentImgUrl) return;
        const preferredPayloadUrl = state.activeLocalUrl || state.activeRemoteUrl || currentImgUrl;

        // Switch to Image-to-Video tab (which automatically selects the #1 pinned promo model)
        const i2vBtn = document.querySelector('.mode-btn[data-category="image-to-video"]');
        if (i2vBtn) i2vBtn.click();

        state.sourceImage = { url: currentImgUrl, downloadUrl: preferredPayloadUrl };
        el.imagePreview.src = currentImgUrl;
        el.imagePreviewContainer.style.display = 'flex';
        document.getElementById('dropzonePrompt').style.display = 'none';
        el.imageUrlInput.value = preferredPayloadUrl;
      });
    }

    // Send to Edit Button
    el.sendToEditBtn.addEventListener('click', () => {
      const currentImgUrl = el.outputImageViewer.src;
      if (!currentImgUrl) return;
      const preferredPayloadUrl = state.activeLocalUrl || state.activeRemoteUrl || currentImgUrl;

      const editBtn = document.querySelector('.mode-btn[data-category="image-edit"]');
      if (editBtn) editBtn.click();

      state.sourceImage = { url: currentImgUrl, downloadUrl: preferredPayloadUrl };
      el.imagePreview.src = currentImgUrl;
      el.imagePreviewContainer.style.display = 'flex';
      document.getElementById('dropzonePrompt').style.display = 'none';
      el.imageUrlInput.value = preferredPayloadUrl;
    });

    // Download Output Button
    el.downloadOutputBtn.addEventListener('click', () => {
      const isImg = el.outputImageViewer.style.display !== 'none';
      const targetUrl = isImg ? el.outputImageViewer.src : el.outputVideoViewer.src;
      if (!targetUrl) return;

      const extMatch = targetUrl.match(/\.(png|jpg|jpeg|webp|gif|svg|mp4|webm|mov)(\?|$)/i);
      const ext = extMatch ? extMatch[1].toLowerCase() : (isImg ? 'png' : 'mp4');
      const a = document.createElement('a');
      a.href = targetUrl;
      a.download = `wavespeed_${Date.now()}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    });

    // Copy Output URL
    el.copyUrlBtn.addEventListener('click', async () => {
      const isImg = el.outputImageViewer.style.display !== 'none';
      const targetUrl = state.activeRemoteUrl || (isImg ? el.outputImageViewer.src : el.outputVideoViewer.src);
      if (targetUrl) {
        const ok = await copyTextSafe(targetUrl);
        if (typeof showToast === 'function') {
          showToast(ok ? 'Output URL copied to clipboard.' : 'Could not copy output URL.', ok ? 'success' : 'warn');
        }
      }
    });

    // Clear History
    el.clearHistoryBtn.addEventListener('click', () => {
      state.history = [];
      localStorage.removeItem('wavespeed_studio_history');
      renderHistory();
    });

    // API Key & Settings Modal
    el.apiKeyModalBtn.addEventListener('click', () => {
      openApiKeyModal(false);
    });
    el.closeModalBtn.addEventListener('click', () => el.apiKeyModal.style.display = 'none');
    el.cancelModalBtn.addEventListener('click', () => el.apiKeyModal.style.display = 'none');
    if (el.browseOutputsDirBtn && window.waveSpeedDesktop?.selectOutputsFolder) {
      el.browseOutputsDirBtn.style.display = 'inline-flex';
      el.browseOutputsDirBtn.addEventListener('click', async () => {
        const currentVal = el.outputsDirInput?.value?.trim() || state.outputsDir || '';
        const picked = await window.waveSpeedDesktop.selectOutputsFolder(currentVal);
        if (picked && !picked.canceled && picked.path && el.outputsDirInput) {
          el.outputsDirInput.value = picked.path;
        }
      });
    }
    el.saveApiKeyBtn.addEventListener('click', async () => {
      const newKey = el.apiKeyInput.value.trim();
      const requestedOutputsDir = el.outputsDirInput ? el.outputsDirInput.value.trim() : '';
      const outputsDirChanged = Boolean(requestedOutputsDir && requestedOutputsDir !== state.outputsDir);
      const discountInput = document.getElementById('accountDiscountInput');
      if (discountInput) {
        state.accountDiscount = parseInt(discountInput.value || '0', 10);
        localStorage.setItem('wavespeed_extra_discount', state.accountDiscount);
      }
      if (el.spendGuardEnabledInput) {
        state.spendGuardEnabled = Boolean(el.spendGuardEnabledInput.checked);
        localStorage.setItem('wavespeed_spend_guard_enabled', String(state.spendGuardEnabled));
      }
      if (el.spendGuardThresholdInput) {
        const parsed = parseFloat(el.spendGuardThresholdInput.value);
        if (!isNaN(parsed) && parsed >= 0) {
          state.spendGuardThreshold = parsed;
          localStorage.setItem('wavespeed_spend_guard_threshold', String(parsed));
        }
      }

      if (newKey || outputsDirChanged) {
        const configPayload = {};
        if (newKey) configPayload.apiKey = newKey;
        if (outputsDirChanged) configPayload.outputsDir = requestedOutputsDir;
        const cfgRes = await fetch('/api/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(configPayload)
        });
        const cfgData = await cfgRes.json().catch(() => ({}));
        if (!cfgRes.ok) {
          if (typeof showToast === 'function') {
            showToast(cfgData.error || 'Failed to update settings.', 'warn');
          }
          return;
        }
        if (cfgData.outputsDir) {
          applyOutputsDirUi(cfgData.outputsDir);
        }
        if (typeof showToast === 'function' && cfgData.message) {
          showToast(cfgData.message, 'good');
        }
      }
      el.apiKeyModal.style.display = 'none';
      if (newKey) {
        el.apiKeyInput.value = '';
        await fetchModels();
      }
      if (outputsDirChanged) {
        await fetchSavedOutputs();
      }
      if (state.selectedModel) updateModelInfo(state.selectedModel);
      filterAndRenderAutocomplete();
      fetchBalance();
    });

    // Economy Auto-Defaults Toggle
    if (el.economyDefaultsCheckbox) {
      el.economyDefaultsCheckbox.addEventListener('change', (e) => {
        state.economyDefaultsEnabled = Boolean(e.target.checked);
        localStorage.setItem('wavespeed_economy_defaults', String(state.economyDefaultsEnabled));
        if (state.selectedModel) {
          adaptUIForModel(state.selectedModel);
          updateModelInfo(state.selectedModel);
        }
      });
    }

    // Full SQLite History DB Modal Listeners
    if (el.openHistoryDbBtn) {
      el.openHistoryDbBtn.addEventListener('click', openHistoryDbModal);
    }
    if (el.openHistoryDbSectionBtn) {
      el.openHistoryDbSectionBtn.addEventListener('click', openHistoryDbModal);
    }
    if (el.closeHistoryDbModalBtn && el.historyDbModal) {
      el.closeHistoryDbModalBtn.addEventListener('click', () => {
        el.historyDbModal.style.display = 'none';
      });
      el.historyDbModal.addEventListener('click', (e) => {
        if (e.target === el.historyDbModal) el.historyDbModal.style.display = 'none';
      });
    }
    if (el.historySearchInput) {
      el.historySearchInput.addEventListener('input', () => fetchAndRenderHistoryDb());
    }
    [el.historyModelFilterSelect, el.historyStatusFilterSelect, el.historyTypeFilterSelect].forEach(sel => {
      if (sel) sel.addEventListener('change', () => fetchAndRenderHistoryDb());
    });
    if (el.historyResyncBtn) {
      el.historyResyncBtn.addEventListener('click', async () => {
        el.historyResyncBtn.textContent = 'Syncing...';
        try {
          const res = await fetch('/api/history/resync', { method: 'POST' });
          const json = await res.json();
          renderHistoryDbModal(json);
        } finally {
          el.historyResyncBtn.textContent = '🔄 Sync Disk';
        }
      });
    }
    async function downloadHistoryExport(format) {
      const qs = buildHistoryQueryParams().toString();
      const url = `/api/history/export?format=${encodeURIComponent(format)}&${qs}`;
      try {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`Export failed (${resp.status})`);
        const blob = await resp.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `wavespeed_studio_history_${Date.now()}.${format === 'json' ? 'json' : 'csv'}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
      } catch (err) {
        if (typeof showToast === 'function') showToast(`Export error: ${err.message}`, 'error');
      }
    }
    if (el.historyExportCsvBtn) {
      el.historyExportCsvBtn.addEventListener('click', () => downloadHistoryExport('csv'));
    }
    if (el.historyExportJsonBtn) {
      el.historyExportJsonBtn.addEventListener('click', () => downloadHistoryExport('json'));
    }

    // Quick History Gallery Filter Pills (All | Images | Videos)
    if (el.historyGalleryFilterPills) {
      el.historyGalleryFilterPills.addEventListener('click', (e) => {
        const btn = e.target.closest('.history-filter-btn');
        if (!btn) return;
        const filterVal = btn.dataset.filter || 'all';
        state.galleryFilter = filterVal;
        el.historyGalleryFilterPills.querySelectorAll('.history-filter-btn').forEach(b => {
          b.classList.toggle('active', b === btn);
        });
        renderHistory();
      });
    }

    // Side-by-Side A/B Compare Modal Listeners
    if (el.openCompareBtn) {
      el.openCompareBtn.addEventListener('click', openCompareModal);
    }
    if (el.closeCompareModalBtn && el.compareModal) {
      el.closeCompareModalBtn.addEventListener('click', () => {
        el.compareModal.style.display = 'none';
      });
      el.compareModal.addEventListener('click', (e) => {
        if (e.target === el.compareModal) el.compareModal.style.display = 'none';
      });
    }
    if (el.clearComparePinsBtn) {
      el.clearComparePinsBtn.addEventListener('click', () => {
        state.compareKeys = [];
        updateCompareBadge();
        renderHistory();
        renderCompareModal();
      });
    }
    if (el.syncPlayCompareVideosBtn && el.compareGrid) {
      el.syncPlayCompareVideosBtn.addEventListener('click', () => {
        const vids = el.compareGrid.querySelectorAll('video');
        vids.forEach(v => {
          try {
            v.currentTime = 0;
            const p = v.play();
            if (p && typeof p.catch === 'function') p.catch(() => {});
          } catch (e) {}
        });
      });
    }

    // Best-For Advisor Modal Listeners
    if (el.openAdvisorBtn) {
      el.openAdvisorBtn.addEventListener('click', openAdvisorModal);
    }
    if (el.closeAdvisorModalBtn && el.advisorModal) {
      el.closeAdvisorModalBtn.addEventListener('click', () => {
        el.advisorModal.style.display = 'none';
      });
      el.advisorModal.addEventListener('click', (e) => {
        if (e.target === el.advisorModal) el.advisorModal.style.display = 'none';
      });
    }

    // Theme, Density & Viewer Stage Design Switcher
    if (el.themeMenuBtn && el.themePopover) {
      el.themeMenuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = el.themePopover.style.display !== 'none';
        el.themePopover.style.display = isOpen ? 'none' : 'flex';
      });
      document.addEventListener('click', (e) => {
        if (el.themePopover && el.themePopover.style.display !== 'none' &&
            !el.themePopover.contains(e.target) && e.target !== el.themeMenuBtn && !el.themeMenuBtn.contains(e.target)) {
          el.themePopover.style.display = 'none';
        }
      });
    }
    if (el.themeSwatches) {
      el.themeSwatches.addEventListener('click', (e) => {
        const btn = e.target.closest('.theme-swatch-btn');
        if (!btn || !btn.dataset.themeChoice) return;
        state.designTheme = btn.dataset.themeChoice;
        localStorage.setItem('wavespeed_studio_theme', state.designTheme);
        applyDesignPreferences();
        showToast(`Theme: ${btn.textContent.trim()}`, 'info');
      });
    }
    if (el.densitySwitch) {
      el.densitySwitch.addEventListener('click', (e) => {
        const btn = e.target.closest('.seg-btn');
        if (!btn || !btn.dataset.densityChoice) return;
        state.designDensity = btn.dataset.densityChoice;
        localStorage.setItem('wavespeed_studio_density', state.designDensity);
        applyDesignPreferences();
      });
    }
    if (el.viewerHeightSwitch) {
      el.viewerHeightSwitch.addEventListener('click', (e) => {
        const btn = e.target.closest('.seg-btn');
        if (!btn || !btn.dataset.stageChoice) return;
        state.viewerStage = btn.dataset.stageChoice;
        localStorage.setItem('wavespeed_viewer_stage', state.viewerStage);
        applyDesignPreferences();
      });
    }

    // Pre-Flight Censorship Shield live listeners
    if (el.promptInput) {
      el.promptInput.addEventListener('input', () => {
        evaluatePreFlightSafety();
        if (state.selectedModel && el.promptInput.value.includes('{')) {
          updateModelInfo(state.selectedModel);
        }
      });
    }
    if (el.negativePromptInput) {
      el.negativePromptInput.addEventListener('input', () => evaluatePreFlightSafety());
    }
    if (el.safetySwitchBtn) {
      el.safetySwitchBtn.addEventListener('click', async () => {
        if (!state.recommendedUncensoredModelId) return;
        await selectModel(state.recommendedUncensoredModelId, true);
        showToast(`Switched to uncensored: ${state.recommendedUncensoredModelId}`, 'good');
      });
    }

    // Zero-Cost Video Frame Grabber & Before/After Split-Wipe & Quick Recipe Clone
    if (el.grabFrameEditBtn) {
      el.grabFrameEditBtn.addEventListener('click', () => captureVideoFrameAndRoute('image-edit', false));
    }
    if (el.grabLastFrameI2VBtn) {
      el.grabLastFrameI2VBtn.addEventListener('click', () => captureVideoFrameAndRoute('image-to-video', true));
    }
    if (el.beforeAfterToggleBtn) {
      el.beforeAfterToggleBtn.addEventListener('click', () => toggleBeforeAfter());
    }
    if (el.beforeAfterStage) {
      let wiping = false;
      const updateWipeFromEvent = (clientX) => {
        const rect = el.beforeAfterStage.getBoundingClientRect();
        if (!rect.width) return;
        const pct = Math.max(2, Math.min(98, ((clientX - rect.left) / rect.width) * 100));
        state.beforeAfterWipePct = pct;
        el.beforeAfterStage.style.setProperty('--wipe-pct', `${pct.toFixed(1)}%`);
      };
      el.beforeAfterStage.addEventListener('pointerdown', (e) => {
        wiping = true;
        if (el.beforeAfterStage.setPointerCapture) el.beforeAfterStage.setPointerCapture(e.pointerId);
        updateWipeFromEvent(e.clientX);
      });
      el.beforeAfterStage.addEventListener('pointermove', (e) => {
        if (wiping) updateWipeFromEvent(e.clientX);
      });
      el.beforeAfterStage.addEventListener('pointerup', () => { wiping = false; });
      el.beforeAfterStage.addEventListener('pointercancel', () => { wiping = false; });
    }
    if (el.reuseActiveBtn) {
      el.reuseActiveBtn.addEventListener('click', () => {
        if (state.activeOutputItem) reuseHistoryRun(state.activeOutputItem, false);
      });
    }

    // Gallery Card Size Pills (S / M / L) & Bulk Select Delete
    if (el.gallerySizePills) {
      el.gallerySizePills.addEventListener('click', (e) => {
        const btn = e.target.closest('.history-filter-btn');
        if (!btn || !btn.dataset.gsize) return;
        state.gallerySize = btn.dataset.gsize;
        localStorage.setItem('wavespeed_gallery_size', state.gallerySize);
        applyDesignPreferences();
      });
    }
    if (el.toggleBulkSelectBtn) {
      el.toggleBulkSelectBtn.addEventListener('click', () => {
        state.bulkSelectMode = !state.bulkSelectMode;
        if (!state.bulkSelectMode) state.bulkSelectedKeys = [];
        el.toggleBulkSelectBtn.classList.toggle('is-active', state.bulkSelectMode);
        el.toggleBulkSelectBtn.textContent = state.bulkSelectMode ? '✕ Cancel Select' : '☑️ Select';
        renderHistory();
      });
    }
    if (el.bulkDeleteSelectedBtn) {
      el.bulkDeleteSelectedBtn.addEventListener('click', () => executeBulkDelete());
    }

    // Snappy Global Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
      const anyModalOpen = [el.apiKeyModal, el.spendConfirmModal, el.outputsModal, el.historyDbModal, el.advisorModal, el.compareModal]
        .some(m => m && m.style.display !== 'none');
      if (e.key === 'Escape') {
        if (el.themePopover && el.themePopover.style.display !== 'none') {
          el.themePopover.style.display = 'none';
          return;
        }
        if (anyModalOpen) {
          [el.apiKeyModal, el.outputsModal, el.historyDbModal, el.advisorModal, el.compareModal].forEach(m => {
            if (m && m.style.display !== 'none') m.style.display = 'none';
          });
          return;
        }
      }
      if (anyModalOpen) return;

      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        runGeneration();
        return;
      }

      const tag = (document.activeElement?.tagName || '').toLowerCase();
      const isTyping = tag === 'input' || tag === 'textarea' || tag === 'select' || document.activeElement?.isContentEditable;
      if (isTyping) return;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        stepHistoryViewer(-1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        stepHistoryViewer(1);
      } else if (e.key === ' ' && el.outputVideoViewer && el.outputVideoViewer.style.display !== 'none') {
        e.preventDefault();
        if (el.outputVideoViewer.paused) {
          const p = el.outputVideoViewer.play();
          if (p && typeof p.catch === 'function') p.catch(() => {});
        } else {
          el.outputVideoViewer.pause();
        }
      } else if ((e.key === 'f' || e.key === 'F') && el.fullscreenVideoBtn && el.fullscreenVideoBtn.style.display !== 'none') {
        e.preventDefault();
        el.fullscreenVideoBtn.click();
      }
    });
  }

  function showToast(message, tone = 'info', durationMs = 2600) {
    if (!el.studioToastContainer || !message) return;
    const toast = document.createElement('div');
    toast.className = `studio-toast is-${tone}`;
    toast.textContent = message;
    el.studioToastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 150ms';
      setTimeout(() => toast.remove(), 160);
    }, durationMs);
  }

  function applyDesignPreferences() {
    if (document.body && typeof document.body.setAttribute === 'function') {
      document.body.setAttribute('data-theme', state.designTheme || 'obsidian-pro');
      document.body.setAttribute('data-density', state.designDensity || 'compact');
      document.body.setAttribute('data-viewer-stage', state.viewerStage || 'tall');
    }

    const sizeMap = { sm: '142px', md: '185px', lg: '248px' };
    if (document.documentElement?.style && typeof document.documentElement.style.setProperty === 'function') {
      document.documentElement.style.setProperty('--gallery-card-min', sizeMap[state.gallerySize] || '185px');
    }

    if (el.themeSwatches) {
      el.themeSwatches.querySelectorAll('.theme-swatch-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.themeChoice === state.designTheme);
      });
    }
    if (el.densitySwitch) {
      el.densitySwitch.querySelectorAll('.seg-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.densityChoice === state.designDensity);
      });
    }
    if (el.viewerHeightSwitch) {
      el.viewerHeightSwitch.querySelectorAll('.seg-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.stageChoice === state.viewerStage);
      });
    }
    if (el.gallerySizePills) {
      el.gallerySizePills.querySelectorAll('.history-filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.gsize === state.gallerySize);
      });
    }
  }

  function getBeforeImageForItem(item) {
    if (!item || item.isVideo) return null;
    if (item.input_image_url) return item.input_image_url;
    if (item.parameters?.image) return item.parameters.image;
    if (Array.isArray(item.parameters?.images) && item.parameters.images[0]) return item.parameters.images[0];
    return null;
  }

  function toggleBeforeAfter(forceState = null) {
    if (!el.beforeAfterStage || !el.outputImageViewer || !state.activeOutputItem) return;
    const beforeUrl = getBeforeImageForItem(state.activeOutputItem);
    if (!beforeUrl) {
      showToast('No recorded input image for this output', 'warn');
      return;
    }
    const next = (forceState !== null) ? Boolean(forceState) : !state.beforeAfterActive;
    state.beforeAfterActive = next;
    if (el.beforeAfterToggleBtn) el.beforeAfterToggleBtn.classList.toggle('is-active', next);

    if (next) {
      if (el.baBeforeImg) el.baBeforeImg.src = beforeUrl;
      if (el.baAfterImg) el.baAfterImg.src = el.outputImageViewer.src;
      el.beforeAfterStage.style.setProperty('--wipe-pct', `${state.beforeAfterWipePct || 50}%`);
      el.outputImageViewer.style.display = 'none';
      el.beforeAfterStage.style.display = 'block';
    } else {
      el.beforeAfterStage.style.display = 'none';
      el.outputImageViewer.style.display = 'block';
    }
  }

  async function captureVideoFrameAndRoute(targetCategory, seekToEnd = false) {
    const video = el.outputVideoViewer;
    if (!video || video.style.display === 'none' || !video.src) {
      showToast('Load a video in the Active Viewer first', 'warn');
      return;
    }
    try {
      if (video.readyState < 2) {
        await new Promise((resolve, reject) => {
          const onReady = () => { cleanup(); resolve(); };
          const onErr = () => { cleanup(); reject(new Error('Video frame not ready')); };
          const cleanup = () => {
            video.removeEventListener('loadeddata', onReady);
            video.removeEventListener('error', onErr);
          };
          video.addEventListener('loadeddata', onReady);
          video.addEventListener('error', onErr);
        });
      }
      video.pause();
      if (seekToEnd && Number.isFinite(video.duration) && video.duration > 0.08) {
        const targetTime = Math.max(0, video.duration - 0.06);
        if (Math.abs(video.currentTime - targetTime) > 0.02) {
          await new Promise((resolve) => {
            const onSeeked = () => { video.removeEventListener('seeked', onSeeked); resolve(); };
            video.addEventListener('seeked', onSeeked);
            video.currentTime = targetTime;
          });
        }
      }
      const w = video.videoWidth || 720;
      const h = video.videoHeight || 720;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, w, h);

      const dataUrl = canvas.toDataURL('image/png');
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      const fname = seekToEnd ? `last-frame-${Date.now()}.png` : `frame-${Date.now()}.png`;
      const file = new File([blob], fname, { type: 'image/png' });

      const tabBtn = document.querySelector(`.mode-btn[data-category="${targetCategory}"]`);
      if (tabBtn) tabBtn.click();

      state.sourceImage = { file, url: dataUrl, downloadUrl: null };
      state.sourceImageDimensions = { width: w, height: h };
      if (el.imagePreview) el.imagePreview.src = dataUrl;
      if (el.imagePreviewContainer) el.imagePreviewContainer.style.display = 'flex';
      const dp = document.getElementById('dropzonePrompt');
      if (dp) dp.style.display = 'none';
      if (el.imageUrlInput) el.imageUrlInput.value = '';
      updateInputQualityAdvisory();
      if (state.selectedModel) updateModelInfo(state.selectedModel);

      showToast(
        seekToEnd
          ? `Extracted end frame (${w}×${h}) at $0.00 → ready for Image-to-Video`
          : `Captured frame @ ${video.currentTime.toFixed(2)}s (${w}×${h}) → ready to edit`,
        'good',
        3200
      );
    } catch (err) {
      showToast(`Frame capture blocked/failed: ${err.message}`, 'error');
    }
  }

  const NSFW_PROMPT_REGEX = /\b(nude|naked|nudity|undress|undressing|topless|nipples|breasts|boobs|pussy|vagina|penis|cock|dick|sex|intercourse|fuck|fucking|blowjob|oral|cum|nsfw|lingerie|nsfw|explicit|strip|stripping|clit|anal|erotic)\b/i;

  function isLikelyStrictSfwModel(modelId) {
    const id = (modelId || '').toLowerCase();
    if (!id) return false;
    if (id.includes('alibaba/wan-3')) return true;
    if (id.startsWith('google/') || id.startsWith('openai/') || id.startsWith('kwaivgi/') || id.startsWith('vidu/')) return true;
    if (id.startsWith('minimax/') && !id.includes('spicy')) return true;
    return false;
  }

  function pickUncensoredFallbackId(model) {
    const candidatesByCat = model?.isImageToVideo
      ? ['wavespeed-ai/minimax-h3/image-to-video-spicy', 'wavespeed-ai/ltx-2.3-spicy/image-to-video', 'wavespeed-ai/wan-2.2-spicy/image-to-video']
      : (model?.isImageEdit
        ? ['wavespeed-ai/qwen-image/edit-plus', 'wavespeed-ai/minimax-h3-image/edit', 'bytedance/seedream-v4.5/edit']
        : (model?.isTextToVideoOrEdit
          ? ['wavespeed-ai/wan-2.2-spicy/text-to-video', 'wavespeed-ai/minimax-h3/text-to-video-spicy']
          : ['wavespeed-ai/z-image/turbo', 'wavespeed-ai/flux-schnell']));
    return candidatesByCat.find(cid => state.models.some(m => m.model_id === cid)) || null;
  }

  function evaluatePreFlightSafety() {
    if (!el.safetyShieldBanner || !el.safetyShieldText || !el.safetySwitchBtn) return;
    const model = state.selectedModel;
    const text = `${el.promptInput?.value || ''} ${el.negativePromptInput?.value || ''}`;
    const hasSfwRisk = Boolean(model && NSFW_PROMPT_REGEX.test(text) && isLikelyStrictSfwModel(model.model_id));
    if (hasSfwRisk) {
      const fallbackId = pickUncensoredFallbackId(model);
      state.recommendedUncensoredModelId = fallbackId;
      el.safetyShieldText.textContent = `⚠️ Safety Pre-Flight: ${model.model_id} enforces upstream SFW moderation and will likely block explicit prompts.`;
      if (fallbackId && fallbackId !== model.model_id) {
        el.safetySwitchBtn.style.display = 'inline-flex';
        el.safetySwitchBtn.textContent = `Switch to ${fallbackId.split('/').slice(-2).join('/')}`;
      } else {
        el.safetySwitchBtn.style.display = 'none';
      }
      el.safetyShieldBanner.style.display = 'flex';
      return;
    }

    // Historical high-failure advisory from local SQLite history stats
    const histStat = (model && state.historyModelStats instanceof Map) ? state.historyModelStats.get(model.model_id) : null;
    if (histStat && Number(histStat.failed_count) >= 2 && Number(histStat.run_count) >= 3) {
      const failPct = Math.round((Number(histStat.failed_count) / Number(histStat.run_count)) * 100);
      if (failPct >= 50) {
        const fallbackId = pickUncensoredFallbackId(model);
        state.recommendedUncensoredModelId = fallbackId;
        el.safetyShieldText.textContent = `📉 History Alert: ${model.model_id} failed ${histStat.failed_count}/${histStat.run_count} past runs (${failPct}% failure rate). Consider switching.`;
        if (fallbackId && fallbackId !== model.model_id) {
          el.safetySwitchBtn.style.display = 'inline-flex';
          el.safetySwitchBtn.textContent = `Switch to ${fallbackId.split('/').slice(-2).join('/')}`;
        } else {
          el.safetySwitchBtn.style.display = 'none';
        }
        el.safetyShieldBanner.style.display = 'flex';
        return;
      }
    }

    el.safetyShieldBanner.style.display = 'none';
    state.recommendedUncensoredModelId = null;
  }

  function syncGalleryActiveHighlight() {
    if (!el.historyGallery) return;
    const activeKey = state.activeOutputItem ? getItemCompareKey(state.activeOutputItem) : null;
    const filtered = getFilteredHistoryItems();
    const cards = el.historyGallery.querySelectorAll('.gallery-item');
    cards.forEach((card, idx) => {
      const it = filtered[idx];
      const key = it ? getItemCompareKey(it) : null;
      card.classList.toggle('is-viewing', Boolean(activeKey && key && key === activeKey));
    });
  }

  function toggleBulkSelectKey(itemKey) {
    if (!itemKey) return;
    const idx = state.bulkSelectedKeys.indexOf(itemKey);
    if (idx === -1) state.bulkSelectedKeys.push(itemKey);
    else state.bulkSelectedKeys.splice(idx, 1);
    renderHistory();
  }

  function updateBulkDeleteUi() {
    if (!el.bulkDeleteSelectedBtn || !el.bulkSelectedCount) return;
    const n = state.bulkSelectedKeys.length;
    el.bulkSelectedCount.textContent = String(n);
    el.bulkDeleteSelectedBtn.style.display = (state.bulkSelectMode && n > 0) ? 'inline-flex' : 'none';
    if (el.bulkStitchSelectedBtn && el.bulkVideoCount) {
      const selectedVids = state.history.filter(h =>
        state.bulkSelectedKeys.includes(getItemCompareKey(h)) &&
        h.isVideo &&
        h.local_url &&
        h.local_url.startsWith('/outputs/')
      );
      el.bulkVideoCount.textContent = String(selectedVids.length);
      el.bulkStitchSelectedBtn.style.display = (state.bulkSelectMode && selectedVids.length >= 2) ? 'inline-flex' : 'none';
    }
  }

  async function executeBulkDelete() {
    const keys = new Set(state.bulkSelectedKeys);
    if (keys.size === 0) return;
    const targets = state.history.filter(h => keys.has(getItemCompareKey(h)));
    if (targets.length === 0) return;
    if (!window.confirm(`Permanently delete ${targets.length} selected output(s) from disk & History DB?`)) return;

    let deleted = 0;
    for (const item of targets) {
      try {
        const res = await fetch('/api/outputs/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ local_path: item.local_path || null, task_id: item.task_id || null })
        });
        if (res.ok) deleted++;
      } catch (e) {}
    }
    state.compareKeys = state.compareKeys.filter(k => !keys.has(k));
    state.history = state.history.filter(h => !keys.has(getItemCompareKey(h)));
    state.bulkSelectedKeys = [];
    state.bulkSelectMode = false;
    if (el.toggleBulkSelectBtn) {
      el.toggleBulkSelectBtn.classList.remove('is-active');
      el.toggleBulkSelectBtn.textContent = '☑️ Select';
    }
    try {
      localStorage.setItem('wavespeed_studio_history', JSON.stringify(state.history.slice(0, 40)));
    } catch (e) {}
    updateCompareBadge();
    renderHistory();
    showToast(`Deleted ${deleted} output(s)`, 'good');
  }

  function stepHistoryViewer(delta) {
    const items = getFilteredHistoryItems();
    if (items.length === 0) return;
    const activeKey = state.activeOutputItem ? getItemCompareKey(state.activeOutputItem) : null;
    let idx = activeKey ? items.findIndex(i => getItemCompareKey(i) === activeKey) : -1;
    if (idx === -1) idx = 0;
    else idx = (idx + delta + items.length) % items.length;
    loadOutputIntoViewer(items[idx]);
  }

  function probeVideoFileMeta(file, cb) {
    try {
      const probe = document.createElement('video');
      probe.preload = 'metadata';
      const objUrl = URL.createObjectURL(file);
      probe.onloadedmetadata = () => {
        URL.revokeObjectURL(objUrl);
        cb({
          width: probe.videoWidth || 0,
          height: probe.videoHeight || 0,
          duration: (probe.duration && isFinite(probe.duration)) ? probe.duration : 0
        });
      };
      probe.onerror = () => {
        URL.revokeObjectURL(objUrl);
        cb({ width: 0, height: 0, duration: 0 });
      };
      probe.src = objUrl;
    } catch (e) {
      cb({ width: 0, height: 0, duration: 0 });
    }
  }

  function probeVideoUrlMeta(url, cb) {
    try {
      const probe = document.createElement('video');
      probe.preload = 'metadata';
      probe.onloadedmetadata = () => {
        cb({
          width: probe.videoWidth || 0,
          height: probe.videoHeight || 0,
          duration: (probe.duration && isFinite(probe.duration)) ? probe.duration : 0
        });
      };
      probe.onerror = () => cb({ width: 0, height: 0, duration: 0 });
      probe.src = url;
    } catch (e) {
      cb({ width: 0, height: 0, duration: 0 });
    }
  }

  function formatTimecode(sec) {
    const s = Math.max(0, Number(sec) || 0);
    const mins = Math.floor(s / 60);
    const rem = (s % 60).toFixed(2).padStart(5, '0');
    return `${String(mins).padStart(2, '0')}:${rem}`;
  }

  function syncRefVideosTextarea() {
    if (!el.refVideosInput) return;
    el.refVideosInput.value = state.refVideos.map(rv => rv.downloadUrl || rv.url || '').filter(Boolean).join('\n');
  }

  function renderRefVideosList() {
    if (!el.refVideosList) return;
    el.refVideosList.innerHTML = '';
    state.refVideos.forEach((rv, idx) => {
      const card = document.createElement('div');
      card.className = 'ref-media-card';

      const info = document.createElement('div');
      info.className = 'ref-media-info';
      const statusTxt = rv.downloadUrl ? 'URL ready' : (rv.file ? 'Local file (uploads on Run)' : 'Pending');
      const dimTxt = (rv.width && rv.height) ? `${rv.width}×${rv.height}` : '';
      const durTxt = rv.duration ? `${Math.round(rv.duration * 10) / 10}s` : '';
      const metaParts = [dimTxt, durTxt, statusTxt].filter(Boolean).join(' • ');

      info.innerHTML = `
        <div class="ref-media-title">
          <span class="ref-slot-tag">Video ${idx + 1}</span>
          <span>${escapeHtml(rv.name || `Clip ${idx + 1}`)}</span>
        </div>
        <div class="ref-media-meta">${escapeHtml(metaParts)}</div>
      `;

      const actions = document.createElement('div');
      actions.className = 'ref-media-actions';

      const tlBtn = document.createElement('button');
      tlBtn.type = 'button';
      tlBtn.className = 'btn-tiny';
      tlBtn.title = 'Open clip in Video Timeline & Frame Picker';
      tlBtn.textContent = '🎞️ Timeline';
      tlBtn.addEventListener('click', () => {
        openVideoInTimeline(rv.file || rv.downloadUrl || rv.url, rv.name || `Video ${idx + 1}`);
      });

      const upBtn = document.createElement('button');
      upBtn.type = 'button';
      upBtn.className = 'btn-tiny';
      upBtn.title = 'Send clip to Tools → Video Upscaler';
      upBtn.textContent = '⬆️ Upscale';
      upBtn.addEventListener('click', () => routeVideoToUpscaler(rv));

      const rmBtn = document.createElement('button');
      rmBtn.type = 'button';
      rmBtn.className = 'btn-tiny';
      rmBtn.title = 'Remove reference video';
      rmBtn.textContent = '✕';
      rmBtn.addEventListener('click', () => {
        state.refVideos = state.refVideos.filter(x => x.id !== rv.id);
        renderRefVideosList();
        syncRefVideosTextarea();
        updateInputQualityAdvisory();
        if (state.selectedModel) updateModelInfo(state.selectedModel);
      });

      actions.appendChild(tlBtn);
      actions.appendChild(upBtn);
      actions.appendChild(rmBtn);
      card.appendChild(info);
      card.appendChild(actions);
      el.refVideosList.appendChild(card);
    });
  }

  function addRefVideoFiles(fileList) {
    if (!fileList || fileList.length === 0) return;
    const props = state.selectedModel?.schema?.properties || {};
    const refVidKey = getRefVideosSchemaKey(props, state.selectedModel) || 'reference_videos';
    const maxVids = Math.min(10, Math.max(1, Number(props[refVidKey]?.maxItems || 5)));
    const remaining = Math.max(0, maxVids - state.refVideos.length);
    const files = Array.from(fileList).slice(0, remaining || maxVids);
    if (files.length === 0) {
      showToast(`Maximum ${maxVids} reference video(s) allowed by selected model`, 'warn');
      return;
    }
    files.forEach((file) => {
      const id = `rv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const entry = { id, file, url: '', downloadUrl: '', name: file.name, width: 0, height: 0, duration: 0 };
      state.refVideos.push(entry);
      probeVideoFileMeta(file, (meta) => {
        entry.width = meta.width;
        entry.height = meta.height;
        entry.duration = meta.duration;
        renderRefVideosList();
        updateInputQualityAdvisory();
        if (state.selectedModel) updateModelInfo(state.selectedModel);
      });
    });
    renderRefVideosList();
    syncRefVideosTextarea();
    if (state.selectedModel) updateModelInfo(state.selectedModel);
  }

  function addRefVideoUrl(url, customName = null) {
    const clean = String(url || '').trim();
    if (!clean) return;
    const id = `rv-url-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const name = customName || clean.split('/').pop()?.split('?')[0] || 'Reference Video URL';
    const entry = { id, file: null, url: clean, downloadUrl: clean, name, width: 0, height: 0, duration: 0 };
    state.refVideos.push(entry);
    renderRefVideosList();
    syncRefVideosTextarea();
    probeVideoUrlMeta(clean, (meta) => {
      entry.width = meta.width;
      entry.height = meta.height;
      entry.duration = meta.duration;
      renderRefVideosList();
      updateInputQualityAdvisory();
      if (state.selectedModel) updateModelInfo(state.selectedModel);
    });
    if (state.selectedModel) updateModelInfo(state.selectedModel);
  }

  function renderRefAudiosList() {
    if (!el.refAudiosList) return;
    el.refAudiosList.innerHTML = '';
    state.refAudios.forEach((ra, idx) => {
      const card = document.createElement('div');
      card.className = 'ref-media-card';
      const statusTxt = ra.downloadUrl ? 'URL ready' : (ra.file ? 'Local file (uploads on Run)' : 'Pending');
      const info = document.createElement('div');
      info.className = 'ref-media-info';
      info.innerHTML = `
        <div class="ref-media-title">
          <span class="ref-slot-tag">Audio ${idx + 1}</span>
          <span>${escapeHtml(ra.name || `Audio ${idx + 1}`)}</span>
        </div>
        <div class="ref-media-meta">${escapeHtml(statusTxt)}</div>
      `;
      const actions = document.createElement('div');
      actions.className = 'ref-media-actions';
      const rmBtn = document.createElement('button');
      rmBtn.type = 'button';
      rmBtn.className = 'btn-tiny';
      rmBtn.textContent = '✕';
      rmBtn.addEventListener('click', () => {
        state.refAudios = state.refAudios.filter(x => x.id !== ra.id);
        renderRefAudiosList();
        if (state.selectedModel) updateModelInfo(state.selectedModel);
      });
      actions.appendChild(rmBtn);
      card.appendChild(info);
      card.appendChild(actions);
      el.refAudiosList.appendChild(card);
    });
  }

  function addRefAudioFiles(fileList) {
    if (!fileList || fileList.length === 0) return;
    Array.from(fileList).slice(0, 5).forEach((file) => {
      state.refAudios.push({
        id: `ra-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        file,
        url: '',
        downloadUrl: '',
        name: file.name
      });
    });
    renderRefAudiosList();
    if (state.selectedModel) updateModelInfo(state.selectedModel);
  }

  function addRefAudioUrl(url) {
    const clean = String(url || '').trim();
    if (!clean) return;
    const name = clean.split('/').pop()?.split('?')[0] || 'Audio URL';
    state.refAudios.push({
      id: `ra-url-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      file: null,
      url: clean,
      downloadUrl: clean,
      name
    });
    renderRefAudiosList();
    if (state.selectedModel) updateModelInfo(state.selectedModel);
  }

  function syncTimelineTimecodeUI() {
    const v = el.timelineVideoPlayer;
    if (!v || !el.timelineTimecode) return;
    const dur = Number.isFinite(v.duration) ? v.duration : 0;
    const cur = Number.isFinite(v.currentTime) ? v.currentTime : 0;
    el.timelineTimecode.textContent = `${formatTimecode(cur)} / ${formatTimecode(dur)}`;
    if (el.timelineScrubber && dur > 0) {
      el.timelineScrubber.value = String(Math.round((cur / dur) * 1000));
    }
  }

  function syncTrimLabelsUI() {
    if (el.trimStartLabel) el.trimStartLabel.textContent = `${Number(state.trimStartSec || 0).toFixed(1)}s`;
    if (el.trimEndLabel) el.trimEndLabel.textContent = `${Number(state.trimEndSec || 15).toFixed(1)}s`;
  }

  async function generateTimelineFilmstrip(videoSrc, duration, width, height) {
    if (!el.timelineFilmstrip || !Number.isFinite(duration) || duration <= 0) return;
    const scanToken = (state.timelineScanToken = (state.timelineScanToken || 0) + 1);
    el.timelineFilmstrip.innerHTML = '';
    const count = 8;
    const probe = document.createElement('video');
    probe.muted = true;
    probe.playsInline = true;
    probe.preload = 'metadata';
    if (!videoSrc.startsWith('blob:') && !videoSrc.startsWith('/outputs/')) {
      probe.crossOrigin = 'anonymous';
    }
    const canvas = document.createElement('canvas');
    const aspect = (width && height) ? (width / height) : (16 / 9);
    canvas.width = 96;
    canvas.height = Math.max(40, Math.round(96 / aspect));
    const ctx = canvas.getContext('2d');

    try {
      await new Promise((resolve, reject) => {
        probe.onloadeddata = resolve;
        probe.onerror = reject;
        probe.src = videoSrc;
      });
      for (let i = 0; i < count; i++) {
        if (state.timelineScanToken !== scanToken) return;
        const targetSec = Math.min(Math.max(0, duration - 0.04), (duration * (i + 0.5)) / count);
        await new Promise((resolve) => {
          const onS = () => { probe.removeEventListener('seeked', onS); resolve(); };
          probe.addEventListener('seeked', onS);
          probe.currentTime = targetSec;
        });
        if (state.timelineScanToken !== scanToken) return;
        ctx.drawImage(probe, 0, 0, canvas.width, canvas.height);
        const img = document.createElement('img');
        img.className = 'timeline-filmstrip-thumb';
        img.src = canvas.toDataURL('image/jpeg', 0.6);
        img.title = `Jump to ${formatTimecode(targetSec)}`;
        img.addEventListener('click', () => {
          if (el.timelineVideoPlayer) {
            el.timelineVideoPlayer.pause();
            el.timelineVideoPlayer.currentTime = targetSec;
          }
        });
        el.timelineFilmstrip.appendChild(img);
        await new Promise(r => setTimeout(r, 0));
      }
    } catch (e) {
      if (state.timelineScanToken === scanToken) {
        el.timelineFilmstrip.innerHTML = '<div style="grid-column: 1 / -1; color: var(--text-muted); font-size: 0.7rem; padding: 6px; text-align: center;">Timeline filmstrip unavailable for CORS video (scrubber &amp; frame capture still work)</div>';
      }
    } finally {
      try {
        probe.pause();
        probe.removeAttribute('src');
        probe.load();
      } catch (cleanupErr) {}
    }
  }

  function openVideoInTimeline(source, label = 'Loaded Clip') {
    if (!source || !el.videoTimelineGroup || !el.timelineVideoPlayer) return;
    el.videoTimelineGroup.style.display = 'block';
    if (el.timelineExtractorBody) {
      el.timelineExtractorBody.style.display = 'flex';
      if (el.toggleTimelineExtractorBtn) el.toggleTimelineExtractorBtn.setAttribute('aria-expanded', 'true');
      if (el.timelineChevron) el.timelineChevron.textContent = '▲';
    }
    if (state.timelineIsObjectUrl && state.timelineVideo?.src) {
      try { URL.revokeObjectURL(state.timelineVideo.src); } catch (e) {}
    }

    state.timelineSource = source;
    const isFile = (typeof File !== 'undefined' && source instanceof File) || (typeof Blob !== 'undefined' && source instanceof Blob);
    const srcUrl = isFile ? URL.createObjectURL(source) : String(source);
    state.timelineIsObjectUrl = isFile;

    el.timelineVideoPlayer.onloadedmetadata = () => {
      const w = el.timelineVideoPlayer.videoWidth || 0;
      const h = el.timelineVideoPlayer.videoHeight || 0;
      const dur = Number.isFinite(el.timelineVideoPlayer.duration) ? el.timelineVideoPlayer.duration : 0;
      state.timelineVideo = { src: srcUrl, name: label, width: w, height: h, duration: dur };
      state.trimStartSec = 0;
      state.trimEndSec = dur > 0 ? Math.min(dur, 15) : 15;
      syncTrimLabelsUI();
      if (el.timelineMetaReadout) {
        el.timelineMetaReadout.textContent = `${w && h ? `${w}×${h} • ` : ''}${dur ? `${dur.toFixed(1)}s` : ''}`;
      }
      if (el.timelineStage) el.timelineStage.style.display = 'flex';
      syncTimelineTimecodeUI();
      generateTimelineFilmstrip(srcUrl, dur, w, h);
    };
    el.timelineVideoPlayer.src = srcUrl;
    el.timelineVideoPlayer.load();
    el.videoTimelineGroup.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  async function runTimelineLocalTrim() {
    const src = state.timelineSource;
    if (!src) {
      showToast('Load a video in Timeline before trimming.', 'warn');
      return;
    }
    const start = Math.max(0, Number(state.trimStartSec) || 0);
    const end = Math.max(start + 0.2, Number(state.trimEndSec) || 15);
    const btn = el.tlRunTrimBtn;
    const origText = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = '✂️ Trimming...'; }
    try {
      const isFile = (typeof File !== 'undefined' && src instanceof File) || (typeof Blob !== 'undefined' && src instanceof Blob);
      const q = `start=${encodeURIComponent(start.toFixed(3))}&end=${encodeURIComponent(end.toFixed(3))}`;
      let res;
      if (isFile) {
        res = await fetch(`/api/video/trim?${q}`, {
          method: 'POST',
          headers: { 'Content-Type': src.type || 'video/mp4', 'x-file-name': encodeURIComponent(src.name || 'clip.mp4') },
          body: src
        });
      } else if (String(src).startsWith('/outputs/')) {
        res = await fetch(`/api/video/trim?${q}&local_url=${encodeURIComponent(String(src))}`, { method: 'POST' });
      } else {
        throw new Error('Only PC files or locally saved /outputs/ clips can be trimmed offline.');
      }
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || 'FFmpeg trim failed');
      const rec = json.data;
      addToHistory({
        task_id: rec.task_id,
        url: rec.local_url,
        local_url: rec.local_url,
        remote_url: null,
        local_path: rec.local_path,
        isVideo: true,
        model_id: rec.model_id,
        prompt: rec.prompt,
        price: 0,
        timestamp: rec.saved_at
      });
      loadOutputIntoViewer({
        task_id: rec.task_id,
        url: rec.local_url,
        local_url: rec.local_url,
        local_path: rec.local_path,
        isVideo: true,
        model_id: rec.model_id,
        prompt: rec.prompt,
        price: 0
      });
      if (state.selectedModel && 'video' in (state.selectedModel.schema?.properties || {})) {
        if (el.videoUrlInput) el.videoUrlInput.value = rec.local_url;
        state.sourceVideo = { url: rec.local_url, downloadUrl: null };
        state.sourceVideoDuration = Math.ceil(end - start);
        if (el.openSourceVideoTimelineBtn) el.openSourceVideoTimelineBtn.style.display = 'inline-flex';
        if (el.clearSourceVideoBtn) el.clearSourceVideoBtn.style.display = 'inline-flex';
        updateModelInfo(state.selectedModel);
      }
      showToast(`Trimmed ${start.toFixed(1)}s–${end.toFixed(1)}s ($0.00) & loaded cleanly`, 'good', 3500);
    } catch (err) {
      showToast(`Trim error: ${err.message}`, 'error', 4500);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = origText; }
    }
  }

  async function executeBulkStitch() {
    const selectedVids = state.history.filter(h =>
      state.bulkSelectedKeys.includes(getItemCompareKey(h)) &&
      h.isVideo &&
      h.local_url &&
      h.local_url.startsWith('/outputs/')
    );
    if (selectedVids.length < 2) {
      showToast('Select 2 or more locally saved videos to stitch.', 'warn');
      return;
    }
    const urls = selectedVids.map(v => v.local_url);
    const btn = el.bulkStitchSelectedBtn;
    if (btn) btn.disabled = true;
    try {
      const res = await fetch('/api/video/concat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls })
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || 'FFmpeg stitch failed');
      const rec = json.data;
      addToHistory({
        task_id: rec.task_id,
        url: rec.local_url,
        local_url: rec.local_url,
        local_path: rec.local_path,
        isVideo: true,
        model_id: rec.model_id,
        prompt: rec.prompt,
        price: 0,
        timestamp: rec.saved_at
      });
      loadOutputIntoViewer({
        task_id: rec.task_id,
        url: rec.local_url,
        local_url: rec.local_url,
        local_path: rec.local_path,
        isVideo: true,
        model_id: rec.model_id,
        prompt: rec.prompt,
        price: 0
      });
      showToast(`Stitched ${selectedVids.length} clips locally ($0.00 FFmpeg)`, 'good', 3500);
    } catch (err) {
      showToast(`Stitch error: ${err.message}`, 'error', 4500);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function fetchHistoryStatsForInsights() {
    try {
      const res = await fetch('/api/history?limit=1');
      if (!res.ok) return;
      const json = await res.json();
      if (Array.isArray(json?.models)) {
        const mStats = new Map();
        json.models.forEach(m => mStats.set(m.model_id, m));
        state.historyModelStats = mStats;
        evaluatePreFlightSafety();
      }
    } catch (e) {}
  }

  async function checkForAppUpdate() {
    if (!el.updateNotifierBtn || !el.updateNotifierLabel) return;
    try {
      const res = await fetch('/api/check-update');
      if (!res.ok) return;
      const info = await res.json();
      if (info && info.hasUpdate && info.latestVersion) {
        el.updateNotifierBtn.href = info.releaseUrl || 'https://github.com/Cameldroid/wavespeed-studio/releases';
        el.updateNotifierLabel.textContent = `Update v${info.latestVersion}`;
        el.updateNotifierBtn.style.display = 'inline-flex';
      }
    } catch (e) {}
  }

  async function extractTimelineFrame(targetSlot = 'source') {
    const v = el.timelineVideoPlayer;
    if (!v || !v.src || v.readyState < 2) {
      showToast('Load a video and wait for a frame before extracting', 'warn');
      return;
    }
    const w = v.videoWidth || 720;
    const h = v.videoHeight || 720;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d').drawImage(v, 0, 0, w, h);
    const dataUrl = canvas.toDataURL('image/png');
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    const tLabel = String((v.currentTime || 0).toFixed(2)).replace('.', 's');
    const file = new File([blob], `timeline-${tLabel}.png`, { type: 'image/png' });

    if (targetSlot === 'last') {
      state.lastImage = { file, url: dataUrl, downloadUrl: null };
      if (el.lastImagePreview) el.lastImagePreview.src = dataUrl;
      if (el.lastImagePreviewContainer) el.lastImagePreviewContainer.style.display = 'flex';
      if (el.lastDropzonePrompt) el.lastDropzonePrompt.style.display = 'none';
      if (el.lastImageUrlInput) el.lastImageUrlInput.value = '';
      showToast(`Loaded frame @ ${formatTimecode(v.currentTime)} (${w}×${h}) as End Frame`, 'good');
      return;
    }
    if (targetSlot === 'ref') {
      const id = `ref-tl-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
      state.extraImages.push({ id, file, previewUrl: dataUrl, downloadUrl: null });
      renderExtraImagesGrid();
      if (state.selectedModel) updateModelInfo(state.selectedModel);
      showToast(`Added frame @ ${formatTimecode(v.currentTime)} (${w}×${h}) to Reference Images`, 'good');
      return;
    }

    // Default: Source Image (switch to I2V only if current model has no image input at all)
    const curProps = state.selectedModel?.schema?.properties || {};
    const curAcceptsSingleImg = Boolean('image' in curProps || state.selectedModel?.isImageToVideo);
    if (!curAcceptsSingleImg) {
      const i2vBtn = document.querySelector('.mode-btn[data-category="image-to-video"]');
      if (i2vBtn) i2vBtn.click();
    }
    state.sourceImage = { file, url: dataUrl, downloadUrl: null };
    state.sourceImageDimensions = { width: w, height: h };
    if (el.imagePreview) el.imagePreview.src = dataUrl;
    if (el.imagePreviewContainer) el.imagePreviewContainer.style.display = 'flex';
    const dp = document.getElementById('dropzonePrompt');
    if (dp) dp.style.display = 'none';
    if (el.imageUrlInput) el.imageUrlInput.value = '';
    updateInputQualityAdvisory();
    if (state.selectedModel) updateModelInfo(state.selectedModel);
    showToast(`Extracted frame @ ${formatTimecode(v.currentTime)} (${w}×${h}) into Source Image ($0.00)`, 'good');
  }

  function parseTargetShortEdge(resStr) {
    const r = String(resStr || '').toLowerCase();
    if (r === '360p') return 360;
    if (r === '480p') return 480;
    if (r === '540p') return 540;
    if (r === '720p') return 720;
    if (r === '768p') return 768;
    if (r === '1080p') return 1080;
    if (r === '2k' || r === '1440p') return 1440;
    if (r === '4k' || r === '2160p') return 2160;
    return 0;
  }

  function updateInputQualityAdvisory() {
    if (!el.inputQualityAdvisory || !el.inputQualityAdvisoryText) return;
    const model = state.selectedModel;
    if (!model) {
      el.inputQualityAdvisory.style.display = 'none';
      return;
    }
    const props = model.schema?.properties || {};
    const resKey = getResolutionSchemaKey(props);
    const targetRes = (resKey && el.resolutionSelect?.value) ? el.resolutionSelect.value : (props[resKey]?.default || '');
    const targetEdge = parseTargetShortEdge(targetRes);

    const hasSingleImageSlot = ('image' in props || model.isImageToVideo) && !String(model.model_id || '').includes('upscal');
    const imgDims = state.sourceImageDimensions;
    const vidDims = state.sourceVideoDimensions || state.refVideos.find(rv => rv.width && rv.height) || null;

    if (hasSingleImageSlot && imgDims && targetEdge > 0) {
      const srcEdge = Math.min(imgDims.width, imgDims.height);
      if (srcEdge > 0 && srcEdge < Math.round(targetEdge * 0.85)) {
        const upCost = getPreUpscaleUnitCost();
        el.inputQualityAdvisory.style.display = 'flex';
        el.inputQualityAdvisoryText.innerHTML =
          `⚠️ <strong>Resolution Mismatch:</strong> Source frame is <code>${imgDims.width}×${imgDims.height}</code> (~${srcEdge}p) while target output is <code>${escapeHtml(targetRes)}</code>. Running directly is free ($0 extra) and works, or enable pre-upscale below for sharper early frames.`;
        if (el.preUpscaleLabel && el.preUpscaleLabelText) {
          el.preUpscaleLabel.style.display = 'inline-flex';
          el.preUpscaleLabelText.textContent = `✨ Pre-upscale low-res frame via Real-ESRGAN (+$${upCost.toFixed(4)}) before running`;
        }
        if (el.routeToVideoUpscalerBtn) el.routeToVideoUpscalerBtn.style.display = 'none';
        return;
      }
    }

    if (('video' in props || getRefVideosSchemaKey(props, model)) && vidDims && targetEdge > 0 && !String(model.model_id || '').includes('upscal')) {
      const srcVidEdge = Math.min(vidDims.width, vidDims.height);
      if (srcVidEdge > 0 && srcVidEdge < Math.round(targetEdge * 0.85)) {
        el.inputQualityAdvisory.style.display = 'flex';
        el.inputQualityAdvisoryText.innerHTML =
          `⚠️ <strong>Low-Res Reference Clip:</strong> Clip is <code>${vidDims.width}×${vidDims.height}</code> (~${srcVidEdge}p) vs target <code>${escapeHtml(targetRes)}</code>. R2V mainly copies motion cleanly, whereas V2V/Video Edit closely follows source quality.`;
        if (el.preUpscaleLabel) el.preUpscaleLabel.style.display = 'none';
        if (el.preUpscaleCheckbox) el.preUpscaleCheckbox.checked = false;
        if (el.routeToVideoUpscalerBtn) el.routeToVideoUpscalerBtn.style.display = 'inline-flex';
        return;
      }
    }

    el.inputQualityAdvisory.style.display = 'none';
    if (el.preUpscaleLabel) el.preUpscaleLabel.style.display = 'none';
    if (el.preUpscaleCheckbox) el.preUpscaleCheckbox.checked = false;
    if (el.routeToVideoUpscalerBtn) el.routeToVideoUpscalerBtn.style.display = 'none';
  }

  function routeVideoToUpscaler(clipEntry = null) {
    const toolsTab = document.querySelector('.mode-btn[data-category="utility"]');
    if (toolsTab) toolsTab.click();
    const preferredUpscalers = [
      'wavespeed-ai/video-upscaler',
      'bytedance/video-upscaler',
      'wavespeed-ai/flashvsr',
      'wavespeed-ai/video-upscaler-pro'
    ];
    const targetModelId = preferredUpscalers.find(id => state.models.some(m => m.model_id === id))
      || state.models.find(m => m.type === 'upscale-video')?.model_id;
    if (targetModelId) selectModel(targetModelId, true);

    const chosen = clipEntry || (state.sourceVideo ? state.sourceVideo : state.refVideos[0]);
    if (chosen) {
      state.sourceVideo = chosen.file
        ? { file: chosen.file }
        : { url: chosen.downloadUrl || chosen.url, downloadUrl: chosen.downloadUrl || chosen.url };
      if (el.videoUrlInput) el.videoUrlInput.value = chosen.file ? '' : (chosen.downloadUrl || chosen.url || '');
      if (el.videoDropzone) {
        const p = el.videoDropzone.querySelector('p');
        if (p) p.textContent = `Loaded: ${chosen.name || chosen.file?.name || 'Reference Video'}`;
      }
    }
    showToast('Loaded clip into Tools → Video Upscaler (choose target resolution & Run)', 'good');
  }

  function handleImageFile(file) {
    state.sourceImage = { file };
    state.sourceImageDimensions = null;
    const reader = new FileReader();
    reader.onload = (e) => {
      el.imagePreview.onload = () => {
        if (el.imagePreview.naturalWidth && el.imagePreview.naturalHeight) {
          state.sourceImageDimensions = {
            width: el.imagePreview.naturalWidth,
            height: el.imagePreview.naturalHeight
          };
          updateInputQualityAdvisory();
        }
      };
      el.imagePreview.src = e.target.result;
      el.imagePreviewContainer.style.display = 'flex';
      document.getElementById('dropzonePrompt').style.display = 'none';
    };
    reader.readAsDataURL(file);
  }

  // Start app
  init();
})();
