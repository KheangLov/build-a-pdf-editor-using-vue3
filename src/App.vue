<template>
  <v-app>
    <v-layout class="app-shell">

      <!-- ── Left sidebar ───────────────────────────────────────────── -->
      <v-navigation-drawer
        v-model="leftDrawerOpen"
        :mobile="false"
        width="312"
        class="side-panel"
      >
        <div class="brand-bar">
          <div>
            <div class="brand-title">PDF Studio</div>
            <div class="brand-subtitle">Vue 3 + Vuetify editor</div>
          </div>
          <v-chip size="small" color="primary" variant="flat">Beta</v-chip>
        </div>

        <v-divider />

        <div class="panel-section">
          <div class="section-title">Document</div>
          <input
            ref="pdfFileInput"
            class="hidden-file-input"
            type="file"
            accept="application/pdf,.pdf"
            @change="handlePdfInputChange"
          />
          <v-btn block color="primary" variant="tonal" prepend-icon="mdi-file-pdf-box" @click="openPdfPicker">
            Open PDF
          </v-btn>
          <div v-if="selectedPdfName" class="selected-file-name">{{ selectedPdfName }}</div>
          <div class="document-actions">
            <v-btn color="primary" prepend-icon="mdi-file-plus-outline" @click="createBlankPdf">
              Blank PDF
            </v-btn>
            <v-btn variant="tonal" color="secondary" prepend-icon="mdi-download" @click="exportPdf">
              Export
            </v-btn>
          </div>
        </div>

        <v-divider />

        <div class="panel-section">
          <div class="section-title">Tools</div>
          <v-btn-toggle v-model="activeTool" class="tool-grid" mandatory divided>
            <v-btn value="select" icon="mdi-cursor-default-outline" aria-label="Select" />
            <v-btn value="text" icon="mdi-format-text" aria-label="Add text" />
            <v-btn value="comment" icon="mdi-comment-text-outline" aria-label="Add comment" />
            <v-btn value="image" icon="mdi-image-plus-outline" aria-label="Add image" />
            <v-btn value="signature" icon="mdi-draw" aria-label="Add signature" />
          </v-btn-toggle>

          <v-text-field v-if="activeTool === 'text'" v-model="draftText" label="Text" />
          <v-textarea v-if="activeTool === 'comment'" v-model="draftComment" label="Comment" rows="3" />
          <v-file-input
            v-if="activeTool === 'image'"
            label="Image"
            accept="image/png,image/jpeg"
            prepend-icon="mdi-image"
            @update:model-value="loadImageFile"
          />
          <div v-if="activeTool === 'signature'" class="signature-tool">
            <canvas
              ref="signatureCanvas"
              class="signature-pad"
              width="260"
              height="96"
              @pointerdown="startSignature"
              @pointermove="drawSignature"
              @pointerup="stopSignature"
              @pointerleave="stopSignature"
            />
            <div class="compact-actions">
              <v-btn size="small" variant="tonal" prepend-icon="mdi-eraser" @click="clearSignature">
                Clear
              </v-btn>
              <v-btn size="small" color="primary" prepend-icon="mdi-check" @click="captureSignature">
                Use
              </v-btn>
            </div>
          </div>
        </div>

        <v-divider />

        <div class="panel-section">
          <div class="section-title">Dynamic Data</div>
          <v-text-field v-model="apiUrl" label="API URL" placeholder="https://api.example.com/customer" />
          <div class="param-row" v-for="param in apiParams" :key="param.id">
            <v-text-field v-model="param.key" label="Param" hide-details />
            <v-text-field v-model="param.value" label="Value" hide-details />
            <v-btn icon="mdi-close" variant="text" aria-label="Remove param" @click="removeParam(param.id)" />
          </div>
          <div class="compact-actions">
            <v-btn size="small" variant="tonal" prepend-icon="mdi-plus" @click="addParam">Param</v-btn>
            <v-btn size="small" color="accent" prepend-icon="mdi-cloud-download-outline" @click="fetchApiData">
              Fetch
            </v-btn>
          </div>
          <v-alert v-if="apiError" type="error" variant="tonal" density="compact" class="mt-3">
            {{ apiError }}
          </v-alert>
          <v-select
            v-if="dataFields.length"
            v-model="selectedDataField"
            :items="dataFields"
            label="Field"
            class="mt-3"
          />
          <v-btn
            v-if="dataFields.length"
            block
            color="primary"
            variant="tonal"
            prepend-icon="mdi-map-marker-plus-outline"
            @click="insertMappedField"
          >
            Place Field
          </v-btn>
        </div>
      </v-navigation-drawer>

      <!-- ── Right sidebar – page previewer ────────────────────────── -->
      <v-navigation-drawer
        v-model="rightDrawerOpen"
        :mobile="false"
        location="right"
        width="160"
        class="right-panel"
      >
        <div class="right-panel-header">
          <span class="section-title" style="margin-bottom:0">Pages</span>
        </div>
        <v-divider />
        <div class="thumbnails-list">
          <div
            v-for="pageNum in pageCount"
            :id="`thumb-${pageNum}`"
            :key="pageNum"
            class="thumbnail-item"
            :class="{ 'thumbnail-active': currentPage === pageNum }"
            @click="setPage(pageNum)"
          >
            <div class="thumbnail-frame">
              <img
                v-if="thumbnailDataUrls[pageNum - 1]"
                :src="thumbnailDataUrls[pageNum - 1]"
                class="thumbnail-img"
                :alt="`Page ${pageNum}`"
              />
              <div v-else class="thumbnail-loading">
                <v-progress-circular size="16" indeterminate color="primary" />
              </div>
            </div>
            <span class="thumbnail-label">{{ pageNum }}</span>
          </div>
        </div>
      </v-navigation-drawer>

      <!-- ── Main content ───────────────────────────────────────────── -->
      <v-main>
        <v-toolbar class="top-toolbar" density="comfortable">
          <!-- Left sidebar toggle -->
          <v-btn
            :icon="leftDrawerOpen ? 'mdi-menu-open' : 'mdi-menu'"
            variant="text"
            aria-label="Toggle sidebar"
            @click="leftDrawerOpen = !leftDrawerOpen"
          />
          <v-divider vertical class="mx-1" />

          <!-- Zoom -->
          <v-btn icon="mdi-minus" variant="text" aria-label="Zoom out" @click="zoomBy(-0.1)" />
          <v-slider v-model="zoom" min="0.6" max="1.8" step="0.05" hide-details class="zoom-slider" />
          <v-btn icon="mdi-plus" variant="text" aria-label="Zoom in" @click="zoomBy(0.1)" />
          <v-divider vertical class="mx-1" />

          <!-- Page navigation -->
          <v-btn
            icon="mdi-chevron-left"
            variant="text"
            aria-label="Previous page"
            :disabled="currentPage <= 1"
            @click="setPage(currentPage - 1)"
          />
          <v-text-field
            v-model.number="pageInput"
            class="page-input"
            type="number"
            min="1"
            :max="pageCount || 1"
            hide-details
            density="compact"
            @keyup.enter="setPage(pageInput)"
            @blur="setPage(pageInput)"
          />
          <v-btn
            icon="mdi-chevron-right"
            variant="text"
            aria-label="Next page"
            :disabled="currentPage >= pageCount"
            @click="setPage(currentPage + 1)"
          />

          <v-spacer />

          <v-chip color="secondary" variant="tonal" prepend-icon="mdi-layers-outline">
            {{ currentPageAnnotationCount }} / {{ annotations.length }} items
          </v-chip>
          <v-chip color="primary" variant="tonal" prepend-icon="mdi-file-document-outline" class="ml-2">
            Page {{ currentPage }} / {{ pageCount || 1 }}
          </v-chip>

          <v-divider vertical class="mx-1" />

          <!-- Right sidebar toggle -->
          <v-btn
            :icon="rightDrawerOpen ? 'mdi-dock-right' : 'mdi-view-split-vertical'"
            variant="text"
            aria-label="Toggle page previewer"
            @click="rightDrawerOpen = !rightDrawerOpen"
          />
        </v-toolbar>

        <!-- ── Workspace ─────────────────────────────────────────────── -->
        <div ref="workspaceRef" class="workspace" @scroll.passive="handleWorkspaceScroll">
          <div v-if="!pdfBytes" class="empty-state">
            <v-icon icon="mdi-file-edit-outline" size="72" />
            <h1>Open a PDF or start with a blank page</h1>
            <p>Add text, images, comments, signatures, and live API fields, then export the final PDF.</p>
            <v-btn color="primary" prepend-icon="mdi-file-plus-outline" @click="createBlankPdf">Create Blank PDF</v-btn>
          </div>

          <div v-else class="pages-container">
            <v-alert v-if="renderError" type="error" variant="tonal" class="mb-4" style="width:100%">
              {{ renderError }}
            </v-alert>
            <v-progress-linear v-if="isRendering" color="primary" indeterminate class="mb-2" style="width:100%" />

            <div
              v-for="pageNum in pageCount"
              :key="pageNum"
              :ref="(el) => setPageWrap(el as HTMLElement | null, pageNum)"
              class="page-wrap"
              :style="{ width: pageWrapWidth(pageNum) }"
            >
              <div
                class="page-surface"
                :style="pageSurfaceStyle(pageNum)"
                @click="handlePageClick($event, pageNum)"
              >
                <canvas
                  :ref="(el) => setPageCanvas(el as HTMLCanvasElement | null, pageNum)"
                  class="pdf-canvas"
                />
                <div v-if="!renderedPages.has(pageNum)" class="page-placeholder">
                  <v-icon icon="mdi-file-document-outline" size="56" />
                  <div>Page {{ pageNum }}</div>
                  <span>Preparing preview</span>
                </div>
                <div
                  v-for="item in annotationsForPage(pageNum)"
                  :key="item.id"
                  class="annotation"
                  :class="[
                    `annotation-${item.type}`,
                    { selected: selectedAnnotationId === item.id, dragging: dragState?.id === item.id }
                  ]"
                  :style="annotationStyle(item)"
                  @pointerdown.stop="handleAnnotationPointerDown($event, item)"
                  @click.stop="handleAnnotationClick(item)"
                >
                  <template v-if="item.type === 'text' || item.type === 'field'">
                    <input
                      v-if="editingAnnotationId === item.id"
                      class="text-edit-input"
                      :value="item.value"
                      @input="updateAnnotationValue(item.id, ($event.target as HTMLInputElement).value)"
                      @blur="editingAnnotationId = null"
                      @keydown.enter.stop="editingAnnotationId = null"
                      @keydown.escape.stop="editingAnnotationId = null"
                      @pointerdown.stop
                      @click.stop
                      autofocus
                    />
                    <span v-else>{{ item.value }}</span>
                  </template>
                  <template v-else-if="item.type === 'comment'">
                    <v-icon icon="mdi-comment-text-outline" size="18" />
                    <span>{{ item.value }}</span>
                  </template>
                  <img v-else :src="annotationImageSrc(item)" :alt="item.type" />
                  <v-btn
                    v-if="selectedAnnotationId === item.id"
                    class="delete-btn"
                    icon="mdi-close"
                    size="x-small"
                    color="error"
                    variant="elevated"
                    @pointerdown.stop
                    @click.stop="deleteAnnotation(item.id)"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </v-main>
    </v-layout>

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="2600">
      {{ snackbar.text }}
    </v-snackbar>
  </v-app>
</template>

<script setup lang="ts">
import { computed, markRaw, nextTick, onMounted, ref, shallowRef, watch } from 'vue';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

type Tool = 'select' | 'text' | 'comment' | 'image' | 'signature';
type ImageMimeType = 'image/png' | 'image/jpeg';

interface ApiParam {
  id: string;
  key: string;
  value: string;
}

interface ImageAsset {
  src: string;
  bytes: Uint8Array;
  mimeType: ImageMimeType;
}

interface BaseAnnotation {
  id: string;
  x: number;
  y: number;
  page: number;
  pageWidth: number;
  pageHeight: number;
  width: number;
  height: number;
}

type TextAnnotation = BaseAnnotation & {
  type: 'text' | 'field';
  value: string;
};

type CommentAnnotation = BaseAnnotation & {
  type: 'comment';
  value: string;
};

type ImageAnnotation = BaseAnnotation & ImageAsset & {
  type: 'image' | 'signature';
};

type Annotation = TextAnnotation | CommentAnnotation | ImageAnnotation;

interface PageSize {
  width: number;
  height: number;
}

interface SnackbarState {
  show: boolean;
  text: string;
  color: 'primary' | 'warning' | 'error' | 'success';
}

interface PdfJsViewport {
  width: number;
  height: number;
}

interface PdfJsPage {
  getViewport(options: { scale: number }): PdfJsViewport;
  render(options: { canvasContext: CanvasRenderingContext2D; viewport: PdfJsViewport }): { promise: Promise<void> };
}

interface PdfJsDocument {
  numPages: number;
  getPage(pageNumber: number): Promise<PdfJsPage>;
}

interface PdfJsGlobal {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument(options: { data: Uint8Array }): { promise: Promise<PdfJsDocument> };
}

interface DragState {
  id: string;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startX: number;
  startY: number;
}

declare global {
  interface Window { pdfjsLib?: PdfJsGlobal }
}

const THUMBNAIL_SCALE = 0.2;

// ── Sidebar state ───────────────────────────────────────────────────
const leftDrawerOpen  = ref(true);
const rightDrawerOpen = ref(true);

// ── Core state ──────────────────────────────────────────────────────
const activeTool          = ref<Tool>('select');
const annotations         = ref<Annotation[]>([]);
const apiError            = ref('');
const apiParams           = ref<ApiParam[]>([{ id: crypto.randomUUID(), key: 'id', value: '1001' }]);
const apiResponse         = ref<unknown>(null);
const apiUrl              = ref('');
const currentImage        = ref<ImageAsset | null>(null);
const currentPage         = ref(1);
const pageInput           = ref(1);
const draftComment        = ref('Review this section');
const draftText           = ref('New text');
const pageCount           = ref(0);
const pdfBytes            = ref<Uint8Array | null>(null);
const pdfFileInput        = ref<HTMLInputElement | null>(null);
const pdfDocument         = shallowRef<PdfJsDocument | null>(null);
const pageViewports       = ref<(PageSize | null)[]>([]);
const renderedPages       = ref(new Set<number>());
const thumbnailDataUrls   = ref<string[]>([]);
const renderError         = ref('');
const isRendering         = ref(false);
const selectedPdfName     = ref('');
const editingAnnotationId = ref<string | null>(null);
const selectedAnnotationId = ref<string | null>(null);
const selectedDataField   = ref('');
const signatureCanvas     = ref<HTMLCanvasElement | null>(null);
const signatureDrawing    = ref(false);
const signatureImage      = ref<ImageAsset | null>(null);
const snackbar            = ref<SnackbarState>({ show: false, text: '', color: 'primary' });
const zoom                = ref(1);
const dragState           = ref<DragState | null>(null);
let renderSequence = 0;

// DOM ref maps — non-reactive, populated by template ref callbacks
const pageCanvasMap: Record<number, HTMLCanvasElement> = {};
const pageWrapMap: Record<number, HTMLElement>         = {};

// ── Computed ────────────────────────────────────────────────────────
const dataFields = computed(() => flattenObject(apiResponse.value));
const currentPageAnnotationCount = computed(
  () => annotations.value.filter((a) => a.page === currentPage.value).length
);

// ── Template ref callbacks ──────────────────────────────────────────
function setPageCanvas(el: HTMLCanvasElement | null, pageNum: number) {
  if (el) pageCanvasMap[pageNum] = el;
  else delete pageCanvasMap[pageNum];
}

function setPageWrap(el: HTMLElement | null, pageNum: number) {
  if (el) pageWrapMap[pageNum] = el;
  else delete pageWrapMap[pageNum];
}

// ── Per-page style helpers ──────────────────────────────────────────
function pageWrapWidth(pageNum: number): string {
  const vp = pageViewports.value[pageNum - 1];
  return vp ? `${Math.round(vp.width * zoom.value)}px` : '794px';
}

function pageSurfaceStyle(pageNum: number) {
  const vp = pageViewports.value[pageNum - 1];
  if (!vp) return { minWidth: '794px', minHeight: '1123px' };
  return {
    width:  `${Math.round(vp.width  * zoom.value)}px`,
    height: `${Math.round(vp.height * zoom.value)}px`
  };
}

function annotationsForPage(pageNum: number): Annotation[] {
  return annotations.value.filter((a) => a.page === pageNum);
}

// ── Watchers ────────────────────────────────────────────────────────
watch(zoom, async () => {
  if (pdfBytes.value && pdfDocument.value) await reRenderAllPages();
}, { flush: 'post' });

watch(currentPage, (pageNum) => {
  pageInput.value = pageNum;
  // Scroll the active thumbnail into view in the right panel
  nextTick(() => {
    document.getElementById(`thumb-${pageNum}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
});

// ── Lifecycle ───────────────────────────────────────────────────────
const workspaceRef = ref<HTMLElement | null>(null);

onMounted(() => {
  initializeSignaturePad();
});

function handleWorkspaceScroll() {
  const ws = workspaceRef.value;
  if (!ws) return;
  const wsRect = ws.getBoundingClientRect();
  const mid = wsRect.top + wsRect.height / 2;
  for (const [numStr, el] of Object.entries(pageWrapMap)) {
    const rect = el.getBoundingClientRect();
    if (rect.top <= mid && rect.bottom >= mid) {
      const pageNum = parseInt(numStr);
      if (pageNum !== currentPage.value) {
        currentPage.value = pageNum;
        pageInput.value   = pageNum;
      }
      break;
    }
  }
}

// ── Helpers ─────────────────────────────────────────────────────────
function showMessage(text: string, color: SnackbarState['color'] = 'primary') {
  snackbar.value = { show: true, text, color };
}

function openPdfPicker() {
  pdfFileInput.value?.click();
}

// ── PDF loading ─────────────────────────────────────────────────────
async function handlePdfInputChange(event: Event) {
  const input = event.target as HTMLInputElement;
  await loadPdfFile(input.files?.[0] ?? null);
  input.value = '';
}

async function loadPdfFile(file: File | null) {
  if (!file) return;
  renderError.value      = '';
  selectedPdfName.value  = file.name;
  pdfBytes.value         = await readFileBytes(file);
  annotations.value      = [];
  selectedAnnotationId.value = null;
  currentPage.value      = 1;
  pageInput.value        = 1;
  await loadAndRenderPdf();
}

async function createBlankPdf() {
  const doc  = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  page.drawText('PDF Studio', { x: 48, y: 780, size: 18, font, color: rgb(0.09, 0.41, 0.67) });
  renderError.value      = '';
  pdfBytes.value         = await doc.save();
  annotations.value      = [];
  selectedPdfName.value  = 'blank-document.pdf';
  currentPage.value      = 1;
  pageInput.value        = 1;
  await loadAndRenderPdf();
}

async function loadAndRenderPdf() {
  await nextTick();
  if (!pdfBytes.value) return;

  const renderId = ++renderSequence;
  isRendering.value  = true;
  renderError.value  = '';

  // Clear existing pages from DOM
  pageCount.value      = 0;
  pageViewports.value  = [];
  renderedPages.value  = new Set();
  thumbnailDataUrls.value = [];
  await nextTick();

  try {
    if (!window.pdfjsLib) throw new Error('PDF preview engine did not load. Refresh and try again.');

    window.pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.js';
    const loadedDoc = await window.pdfjsLib.getDocument({ data: copyBytes(pdfBytes.value) }).promise;
    if (renderId !== renderSequence) return;

    pdfDocument.value         = markRaw(loadedDoc);
    pageCount.value           = loadedDoc.numPages;
    pageViewports.value       = new Array(loadedDoc.numPages).fill(null);
    thumbnailDataUrls.value   = new Array(loadedDoc.numPages).fill('');

    // Let v-for create all page wrappers and canvases
    await nextTick();

    // 1. Render thumbnails first (small scale → fast)
    await renderThumbnails(renderId);

    // 2. Render full pages sequentially
    for (let i = 1; i <= pageCount.value; i++) {
      if (renderId !== renderSequence) return;
      await renderSinglePage(i, renderId);
    }

    if (renderId === renderSequence) {
      showMessage('PDF loaded. Add fields on any page and export when ready.', 'success');
    }
  } catch (error) {
    console.error('Error loading PDF:', error);
    renderError.value = error instanceof Error ? error.message : 'Unable to preview this PDF.';
  } finally {
    if (renderId === renderSequence) isRendering.value = false;
  }
}

async function reRenderAllPages() {
  if (!pdfDocument.value) return;
  const renderId = ++renderSequence;
  isRendering.value   = true;
  renderedPages.value = new Set();
  try {
    for (let i = 1; i <= pageCount.value; i++) {
      if (renderId !== renderSequence) return;
      await renderSinglePage(i, renderId);
    }
  } catch (error) {
    renderError.value = error instanceof Error ? error.message : 'Unable to re-render PDF.';
  } finally {
    if (renderId === renderSequence) isRendering.value = false;
  }
}

async function renderSinglePage(pageNum: number, renderId: number) {
  if (!pdfDocument.value || renderId !== renderSequence) return;

  const page        = markRaw(await pdfDocument.value.getPage(pageNum));
  if (renderId !== renderSequence) return;

  const viewport     = page.getViewport({ scale: zoom.value });
  const baseViewport = page.getViewport({ scale: 1 });

  pageViewports.value[pageNum - 1] = { width: baseViewport.width, height: baseViewport.height };
  await nextTick();

  const canvas = pageCanvasMap[pageNum];
  if (!canvas) return;
  const context = canvas.getContext('2d');
  if (!context) return;

  const ratio     = window.devicePixelRatio || 1;
  canvas.width    = Math.floor(viewport.width  * ratio);
  canvas.height   = Math.floor(viewport.height * ratio);
  canvas.style.width  = `${viewport.width}px`;
  canvas.style.height = `${viewport.height}px`;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, viewport.width, viewport.height);

  await page.render({ canvasContext: context, viewport }).promise;
  if (renderId !== renderSequence) return;

  const updated = new Set(renderedPages.value);
  updated.add(pageNum);
  renderedPages.value = updated;
}

async function renderThumbnails(renderId: number) {
  if (!pdfDocument.value) return;
  for (let i = 1; i <= pageCount.value; i++) {
    if (renderId !== renderSequence) return;

    const page     = markRaw(await pdfDocument.value.getPage(i));
    if (renderId !== renderSequence) return;

    const viewport = page.getViewport({ scale: THUMBNAIL_SCALE });
    const offscreen = document.createElement('canvas');
    offscreen.width  = Math.floor(viewport.width);
    offscreen.height = Math.floor(viewport.height);
    const ctx = offscreen.getContext('2d');
    if (!ctx) continue;

    await page.render({ canvasContext: ctx, viewport }).promise;
    if (renderId !== renderSequence) return;

    thumbnailDataUrls.value[i - 1] = offscreen.toDataURL('image/jpeg', 0.75);
  }
}

// ── Page interaction ────────────────────────────────────────────────
function handlePageClick(event: MouseEvent, pageNum: number) {
  if (!pdfBytes.value || activeTool.value === 'select') return;

  const target = event.currentTarget as HTMLElement;
  const bounds = target.getBoundingClientRect();
  const x = (event.clientX - bounds.left)  / zoom.value;
  const y = (event.clientY - bounds.top)   / zoom.value;
  const pageVp = pageViewports.value[pageNum - 1] ?? { width: 794, height: 1123 };
  const base = {
    id: crypto.randomUUID(), x, y,
    page: pageNum,
    pageWidth:  pageVp.width,
    pageHeight: pageVp.height
  };

  if (activeTool.value === 'text') {
    annotations.value.push({ ...base, type: 'text', value: draftText.value || 'Text', width: 180, height: 32 });
  }
  if (activeTool.value === 'comment') {
    annotations.value.push({ ...base, type: 'comment', value: draftComment.value || 'Comment', width: 220, height: 48 });
  }
  if (activeTool.value === 'image') {
    if (!currentImage.value) { showMessage('Choose an image first.', 'warning'); return; }
    annotations.value.push({ ...base, ...currentImage.value, type: 'image', width: 160, height: 110 });
  }
  if (activeTool.value === 'signature') {
    if (!signatureImage.value) { showMessage('Draw and use a signature first.', 'warning'); return; }
    annotations.value.push({ ...base, ...signatureImage.value, type: 'signature', width: 180, height: 64 });
  }
}

function scrollToPage(pageNum: number) {
  pageWrapMap[pageNum]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function setPage(page: number) {
  if (!pdfBytes.value) return;
  const n = Math.min(pageCount.value || 1, Math.max(1, Math.trunc(Number(page) || 1)));
  pageInput.value            = n;
  currentPage.value          = n;
  editingAnnotationId.value  = null;
  selectedAnnotationId.value = null;
  dragState.value            = null;
  scrollToPage(n);
}

// ── Annotation helpers ──────────────────────────────────────────────
function annotationStyle(item: Annotation) {
  return {
    left:      `${item.x * zoom.value}px`,
    top:       `${item.y * zoom.value}px`,
    width:     `${item.width  * zoom.value}px`,
    minHeight: `${item.height * zoom.value}px`,
    fontSize:  `${Math.max(12, 15 * zoom.value)}px`
  };
}

function annotationImageSrc(item: Annotation): string {
  return item.type === 'image' || item.type === 'signature' ? item.src : '';
}

function startAnnotationDrag(event: PointerEvent, item: Annotation) {
  selectedAnnotationId.value = item.id;
  dragState.value = {
    id: item.id,
    pointerId:    event.pointerId,
    startClientX: event.clientX,
    startClientY: event.clientY,
    startX: item.x,
    startY: item.y
  };
  (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
  window.addEventListener('pointermove', moveAnnotation);
  window.addEventListener('pointerup',   stopAnnotationDrag, { once: true });
}

function moveAnnotation(event: PointerEvent) {
  const state = dragState.value;
  if (!state || event.pointerId !== state.pointerId) return;
  const item = annotations.value.find((a) => a.id === state.id);
  if (!item) return;
  const pageVp = pageViewports.value[item.page - 1] ?? { width: 794, height: 1123 };
  item.x = clamp(state.startX + (event.clientX - state.startClientX) / zoom.value, 0, Math.max(0, pageVp.width  - item.width));
  item.y = clamp(state.startY + (event.clientY - state.startClientY) / zoom.value, 0, Math.max(0, pageVp.height - item.height));
}

function stopAnnotationDrag() {
  dragState.value = null;
  window.removeEventListener('pointermove', moveAnnotation);
}

async function loadImageFile(file: File | File[] | null) {
  const f = Array.isArray(file) ? file[0] : file;
  if (!f) return;
  currentImage.value = {
    src:      URL.createObjectURL(f),
    bytes:    new Uint8Array(await f.arrayBuffer()),
    mimeType: normalizeImageMimeType(f.type)
  };
  showMessage('Click the PDF to place the image.');
}

// ── Signature pad ───────────────────────────────────────────────────
function initializeSignaturePad() {
  const canvas = signatureCanvas.value;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle   = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#101828';
  ctx.lineWidth   = 2;
  ctx.lineCap     = 'round';
}

function startSignature(event: PointerEvent) {
  if (!signatureCanvas.value) return;
  signatureDrawing.value = true;
  const pt  = signaturePoint(event);
  const ctx = signatureCanvas.value.getContext('2d');
  if (!ctx) return;
  ctx.beginPath();
  ctx.moveTo(pt.x, pt.y);
}

function drawSignature(event: PointerEvent) {
  if (!signatureDrawing.value || !signatureCanvas.value) return;
  const pt  = signaturePoint(event);
  const ctx = signatureCanvas.value.getContext('2d');
  if (!ctx) return;
  ctx.lineTo(pt.x, pt.y);
  ctx.stroke();
}

function stopSignature() { signatureDrawing.value = false; }

function signaturePoint(event: PointerEvent) {
  if (!signatureCanvas.value) return { x: 0, y: 0 };
  const b = signatureCanvas.value.getBoundingClientRect();
  return { x: event.clientX - b.left, y: event.clientY - b.top };
}

function clearSignature() {
  signatureImage.value = null;
  initializeSignaturePad();
}

function captureSignature() {
  if (!signatureCanvas.value) return;
  const dataUrl = signatureCanvas.value.toDataURL('image/png');
  signatureCanvas.value.toBlob(async (blob) => {
    if (!blob) return;
    signatureImage.value = {
      src:      dataUrl,
      bytes:    new Uint8Array(await blob.arrayBuffer()),
      mimeType: 'image/png'
    };
    showMessage('Click the PDF to place the signature.');
  }, 'image/png');
}

// ── Dynamic data ────────────────────────────────────────────────────
function addParam() {
  apiParams.value.push({ id: crypto.randomUUID(), key: '', value: '' });
}

function removeParam(id: string) {
  apiParams.value = apiParams.value.filter((p) => p.id !== id);
}

async function fetchApiData() {
  apiError.value = '';
  if (!apiUrl.value) { apiError.value = 'Enter an API URL.'; return; }
  try {
    const url = new URL(apiUrl.value);
    apiParams.value.forEach((p) => { if (p.key) url.searchParams.set(p.key, p.value); });
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Request failed with ${res.status}`);
    apiResponse.value      = await res.json();
    selectedDataField.value = dataFields.value[0] || '';
    showMessage('API data loaded.');
  } catch (error) {
    apiError.value = error instanceof Error ? error.message : 'Unable to load API data.';
  }
}

function flattenObject(value: unknown, prefix = ''): string[] {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) {
    return value.flatMap((e, i) => flattenObject(e, prefix ? `${prefix}.${i}` : String(i)));
  }
  return Object.entries(value as Record<string, unknown>).flatMap(([k, e]) => {
    const path = prefix ? `${prefix}.${k}` : k;
    return e && typeof e === 'object' && !Array.isArray(e) ? flattenObject(e, path) : [path];
  });
}

function getFieldValue(path: string): unknown {
  return path.split('.').reduce<unknown>((cur, key) => {
    if (!cur || typeof cur !== 'object') return undefined;
    return Array.isArray(cur) ? cur[Number(key)] : (cur as Record<string, unknown>)[key];
  }, apiResponse.value);
}

function insertMappedField() {
  if (!selectedDataField.value) return;
  activeTool.value = 'text';
  draftText.value  = String(getFieldValue(selectedDataField.value) ?? '');
  showMessage('Click the PDF to place the mapped field.');
}

// ── Annotation editing ──────────────────────────────────────────────
function handleAnnotationClick(item: Annotation) {
  if (selectedAnnotationId.value === item.id && (item.type === 'text' || item.type === 'field')) {
    editingAnnotationId.value = item.id;
  } else {
    selectedAnnotationId.value = item.id;
    editingAnnotationId.value  = null;
  }
}

function handleAnnotationPointerDown(event: PointerEvent, item: Annotation) {
  if (editingAnnotationId.value === item.id) return;
  startAnnotationDrag(event, item);
}

function updateAnnotationValue(id: string, value: string) {
  const a = annotations.value.find((x) => x.id === id);
  if (a && (a.type === 'text' || a.type === 'field')) (a as TextAnnotation).value = value;
}

function deleteAnnotation(id: string) {
  annotations.value = annotations.value.filter((a) => a.id !== id);
}

// ── Zoom ────────────────────────────────────────────────────────────
function zoomBy(amount: number) {
  zoom.value = Math.min(1.8, Math.max(0.6, Number((zoom.value + amount).toFixed(2))));
}

// ── Export ──────────────────────────────────────────────────────────
async function exportPdf() {
  if (!pdfBytes.value) return;
  const doc   = await PDFDocument.load(pdfBytes.value);
  const font  = await doc.embedFont(StandardFonts.Helvetica);
  const pages = doc.getPages();

  for (const item of annotations.value) {
    const page = pages[item.page - 1];
    if (!page) continue;
    const { width: pdfW, height: pdfH } = page.getSize();
    const scaleX = pdfW / item.pageWidth;
    const scaleY = pdfH / item.pageHeight;
    const x      = item.x  * scaleX;
    const y      = pdfH - (item.y + item.height) * scaleY;
    const w      = item.width  * scaleX;
    const h      = item.height * scaleY;

    if (item.type === 'text' || item.type === 'field') {
      page.drawText(String(item.value), { x, y: y + h - 17, size: 12, font, color: rgb(0.07, 0.09, 0.16), maxWidth: w });
    }
    if (item.type === 'comment') {
      page.drawRectangle({ x, y, width: w, height: h, color: rgb(1, 0.96, 0.67), borderColor: rgb(0.82, 0.47, 0.07), borderWidth: 1 });
      page.drawText(String(item.value), { x: x + 8, y: y + h - 17, size: 10, font, color: rgb(0.48, 0.26, 0.02), maxWidth: w - 16 });
    }
    if (item.type === 'image' || item.type === 'signature') {
      const emb = item.mimeType === 'image/jpeg' ? await doc.embedJpg(item.bytes) : await doc.embedPng(item.bytes);
      page.drawImage(emb, { x, y, width: w, height: h });
    }
  }

  const saved  = await doc.save();
  const buffer = saved.buffer.slice(saved.byteOffset, saved.byteOffset + saved.byteLength) as ArrayBuffer;
  const blob   = new Blob([buffer], { type: 'application/pdf' });
  const link   = document.createElement('a');
  link.href    = URL.createObjectURL(blob);
  link.download = 'edited-document.pdf';
  link.click();
  URL.revokeObjectURL(link.href);
  showMessage('PDF exported.');
}

// ── Utils ────────────────────────────────────────────────────────────
function clamp(v: number, min: number, max: number) { return Math.min(max, Math.max(min, v)); }

function normalizeImageMimeType(mimeType: string): ImageMimeType {
  return mimeType === 'image/jpeg' ? 'image/jpeg' : 'image/png';
}

function copyBytes(bytes: Uint8Array): Uint8Array {
  return new Uint8Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
}

function readFileBytes(file: File): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('Unable to read file.'));
    reader.onload  = () => {
      if (!(reader.result instanceof ArrayBuffer)) { reject(new Error('Cannot read file as binary.')); return; }
      resolve(new Uint8Array(reader.result));
    };
    reader.readAsArrayBuffer(file);
  });
}
</script>

<style scoped>
/* ── Layout ────────────────────────────────────────────────────────── */
.app-shell {
  height: 100vh;
  overflow: hidden;
}

/* v-main must have a concrete height so its children can flex inside it */
:deep(.v-main) {
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* Make v-main's inner wrapper a proper scrollable flex column */
:deep(.v-main__wrap) {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

/* ── Left sidebar ───────────────────────────────────────────────────── */
.side-panel {
  border-right: 1px solid #d9e1ec;
}

.brand-bar {
  align-items: center;
  display: flex;
  justify-content: space-between;
  min-height: 74px;
  padding: 16px;
}

.brand-title {
  color: #101828;
  font-size: 1.1rem;
  font-weight: 700;
}

.brand-subtitle {
  color: #667085;
  font-size: 0.78rem;
}

.panel-section {
  padding: 16px;
}

.hidden-file-input {
  height: 1px;
  opacity: 0;
  pointer-events: none;
  position: absolute;
  width: 1px;
}

.selected-file-name {
  color: #475467;
  font-size: 0.78rem;
  margin-top: 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.section-title {
  color: #344054;
  display: block;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0;
  margin-bottom: 12px;
  text-transform: uppercase;
}

.document-actions,
.compact-actions,
.param-row {
  display: flex;
  gap: 8px;
}

.document-actions .v-btn { flex: 1; }

.tool-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  margin-bottom: 14px;
  width: 100%;
}

.tool-grid :deep(.v-btn) { min-width: 0; }

.signature-tool { display: grid; gap: 10px; }

.signature-pad {
  background: #ffffff;
  border: 1px dashed #98a2b3;
  border-radius: 8px;
  cursor: crosshair;
  height: 96px;
  touch-action: none;
  width: 100%;
}

.param-row {
  align-items: center;
  margin-bottom: 8px;
}

/* ── Right sidebar – page previewer ───────────────────────────────── */
.right-panel {
  border-left: 1px solid #d9e1ec;
}

.right-panel :deep(.v-navigation-drawer__content) {
  display: flex;
  flex-direction: column;
}

.right-panel-header {
  flex-shrink: 0;
  padding: 14px 14px 10px;
}

.thumbnails-list {
  display: flex;
  flex-direction: column;
  flex: 1;
  gap: 10px;
  overflow-y: auto;
  padding: 10px 10px 20px;
}

.thumbnail-item {
  align-items: center;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.thumbnail-frame {
  border: 2px solid transparent;
  border-radius: 4px;
  overflow: hidden;
  transition: border-color 0.15s, box-shadow 0.15s;
  width: 100%;
}

.thumbnail-item:hover .thumbnail-frame {
  border-color: #90b8e0;
}

.thumbnail-active .thumbnail-frame {
  border-color: #1769aa;
  box-shadow: 0 0 0 2px rgb(23 105 170 / 18%);
}

.thumbnail-img {
  display: block;
  height: auto;
  width: 100%;
}

.thumbnail-loading {
  align-items: center;
  aspect-ratio: 210 / 297;
  background: #f2f4f7;
  display: flex;
  justify-content: center;
  width: 100%;
}

.thumbnail-label {
  color: #667085;
  font-size: 0.7rem;
}

/* ── Top toolbar ───────────────────────────────────────────────────── */
.top-toolbar {
  border-bottom: 1px solid #d9e1ec;
  flex-shrink: 0;
  position: sticky;
  top: 0;
  z-index: 10;
}

.zoom-slider { max-width: 200px; }
.page-input  { max-width: 72px;  }

/* ── Workspace ─────────────────────────────────────────────────────── */
.workspace {
  align-items: center;
  display: flex;
  flex: 1 1 0;
  min-height: 0;
  flex-direction: column;
  overflow-y: auto;
  padding: 28px;
}

.empty-state {
  align-items: center;
  color: #475467;
  display: flex;
  flex-direction: column;
  gap: 14px;
  justify-content: center;
  margin: auto;
  max-width: 540px;
  min-height: 64vh;
  text-align: center;
}

.empty-state h1 {
  color: #101828;
  font-size: clamp(1.6rem, 4vw, 2.4rem);
  letter-spacing: 0;
  line-height: 1.1;
  margin: 0;
}

.empty-state p {
  font-size: 1rem;
  line-height: 1.6;
  margin: 0;
}

.pages-container {
  align-items: center;
  display: flex;
  flex-direction: column;
  gap: 24px;
  width: 100%;
}

.page-wrap { flex: 0 0 auto; }

.page-surface {
  background: #ffffff;
  box-shadow: 0 18px 50px rgb(16 24 40 / 18%);
  position: relative;
}

.pdf-canvas {
  display: block;
  height: 100%;
  width: 100%;
}

.page-placeholder {
  align-items: center;
  color: #667085;
  display: flex;
  flex-direction: column;
  gap: 8px;
  height: 100%;
  justify-content: center;
  left: 0;
  padding: 32px;
  position: absolute;
  text-align: center;
  top: 0;
  user-select: none;
  width: 100%;
}

.page-placeholder div {
  color: #344054;
  font-weight: 700;
  max-width: 70%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.page-placeholder span { font-size: 0.82rem; }

/* ── Annotations ───────────────────────────────────────────────────── */
.annotation {
  align-items: flex-start;
  border: 1px solid transparent;
  cursor: pointer;
  display: flex;
  gap: 6px;
  line-height: 1.3;
  overflow: visible;
  padding: 4px 6px;
  position: absolute;
  touch-action: none;
  word-break: break-word;
}

.annotation:hover,
.annotation.selected {
  border-color: #1769aa;
  outline: 2px solid rgb(23 105 170 / 14%);
}

.annotation.dragging { cursor: grabbing; opacity: 0.86; }

.annotation-text,
.annotation-field {
  color: #101828;
  font-weight: 600;
}

.annotation-comment {
  background: #ffef99;
  border-color: #f79009;
  border-radius: 6px;
  color: #7a2e0e;
}

.annotation-image,
.annotation-signature {
  padding: 0;
}

.annotation img {
  display: block;
  height: 100%;
  object-fit: contain;
  width: 100%;
}

.delete-btn {
  border-radius: 50% !important;
  position: absolute;
  right: -12px;
  top: -12px;
}

.text-edit-input {
  background: transparent;
  border: none;
  color: inherit;
  font: inherit;
  font-weight: 600;
  min-width: 0;
  outline: none;
  padding: 0;
  width: 100%;
}

/* ── Responsive ────────────────────────────────────────────────────── */
@media (max-width: 900px) {
  .side-panel { width: 280px !important; }
  .workspace  { padding: 18px; }
}
</style>
