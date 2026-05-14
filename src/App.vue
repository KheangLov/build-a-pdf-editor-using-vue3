<template>
  <v-app>
    <v-layout class="app-shell">
      <v-navigation-drawer permanent width="312" class="side-panel">
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

      <v-main>
        <v-toolbar class="top-toolbar" density="comfortable">
          <v-btn icon="mdi-minus" variant="text" aria-label="Zoom out" @click="zoomBy(-0.1)" />
          <v-slider v-model="zoom" min="0.6" max="1.8" step="0.05" hide-details class="zoom-slider" />
          <v-btn icon="mdi-plus" variant="text" aria-label="Zoom in" @click="zoomBy(0.1)" />
          <v-spacer />
          <v-chip color="secondary" variant="tonal" prepend-icon="mdi-layers-outline">
            {{ annotations.length }} items
          </v-chip>
          <v-chip color="primary" variant="tonal" prepend-icon="mdi-file-document-outline">
            Page {{ currentPage }} / {{ pageCount || 1 }}
          </v-chip>
        </v-toolbar>

        <div class="workspace">
          <div v-if="!pdfBytes" class="empty-state">
            <v-icon icon="mdi-file-edit-outline" size="72" />
            <h1>Open a PDF or start with a blank page</h1>
            <p>Add text, images, comments, signatures, and live API fields, then export the final PDF.</p>
            <v-btn color="primary" prepend-icon="mdi-file-plus-outline" @click="createBlankPdf">Create Blank PDF</v-btn>
          </div>

          <div v-else class="page-wrap" :style="{ width: `${viewportWidth}px` }">
            <v-alert v-if="renderError" type="error" variant="tonal" class="mb-4">
              {{ renderError }}
            </v-alert>
            <v-progress-linear v-if="isRendering" color="primary" indeterminate class="mb-4" />
            <div class="page-surface" :style="pageStyle" @click="handlePageClick">
              <canvas ref="pdfCanvas" class="pdf-canvas" />
              <div v-if="!hasRenderedPage" class="page-placeholder">
                <v-icon icon="mdi-file-document-outline" size="56" />
                <div>{{ selectedPdfName || 'PDF page' }}</div>
                <span>Preparing preview</span>
              </div>
              <div
                v-for="item in annotations"
                :key="item.id"
                class="annotation"
                :class="[`annotation-${item.type}`, { selected: selectedAnnotationId === item.id }]"
                :style="annotationStyle(item)"
                @click.stop="selectedAnnotationId = item.id"
              >
                <template v-if="item.type === 'text' || item.type === 'field'">
                  {{ item.value }}
                </template>
                <template v-else-if="item.type === 'comment'">
                  <v-icon icon="mdi-comment-text-outline" size="18" />
                  <span>{{ item.value }}</span>
                </template>
                <img v-else :src="annotationImageSrc(item)" :alt="item.type" />
                <v-btn
                  v-if="selectedAnnotationId === item.id"
                  class="delete-btn"
                  icon="mdi-trash-can-outline"
                  size="x-small"
                  color="error"
                  @click.stop="deleteAnnotation(item.id)"
                />
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
import { computed, nextTick, onMounted, ref, watch } from 'vue';
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
  GlobalWorkerOptions: {
    workerSrc: string;
  };
  getDocument(options: { data: Uint8Array }): { promise: Promise<PdfJsDocument> };
}

declare global {
  interface Window {
    pdfjsLib?: PdfJsGlobal;
  }
}

const activeTool = ref<Tool>('select');
const annotations = ref<Annotation[]>([]);
const apiError = ref('');
const apiParams = ref<ApiParam[]>([{ id: crypto.randomUUID(), key: 'id', value: '1001' }]);
const apiResponse = ref<unknown>(null);
const apiUrl = ref('');
const currentImage = ref<ImageAsset | null>(null);
const currentPage = ref(1);
const draftComment = ref('Review this section');
const draftText = ref('New text');
const pageCount = ref(0);
const pdfBytes = ref<Uint8Array | null>(null);
const pdfCanvas = ref<HTMLCanvasElement | null>(null);
const pdfFileInput = ref<HTMLInputElement | null>(null);
const pdfDocument = ref<PdfJsDocument | null>(null);
const renderedPage = ref<PageSize>({ width: 794, height: 1123 });
const renderError = ref('');
const isRendering = ref(false);
const hasRenderedPage = ref(false);
const selectedPdfName = ref('');
const selectedAnnotationId = ref<string | null>(null);
const selectedDataField = ref('');
const signatureCanvas = ref<HTMLCanvasElement | null>(null);
const signatureDrawing = ref(false);
const signatureImage = ref<ImageAsset | null>(null);
const snackbar = ref<SnackbarState>({ show: false, text: '', color: 'primary' });
const zoom = ref(1);
let renderSequence = 0;

const viewportWidth = computed(() => Math.round(renderedPage.value.width * zoom.value));
const viewportHeight = computed(() => Math.round(renderedPage.value.height * zoom.value));
const pageStyle = computed(() => ({
  width: `${viewportWidth.value}px`,
  height: `${viewportHeight.value}px`
}));

const dataFields = computed(() => flattenObject(apiResponse.value));

watch(zoom, async () => {
  if (pdfBytes.value) {
    await preparePdfPreview();
  }
}, { flush: 'post' });

onMounted(() => {
  initializeSignaturePad();
});

function showMessage(text: string, color: SnackbarState['color'] = 'primary') {
  snackbar.value = { show: true, text, color };
}

function openPdfPicker() {
  pdfFileInput.value?.click();
}

async function handlePdfInputChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const selectedFile = input.files?.[0] ?? null;
  await loadPdfFile(selectedFile);
  input.value = '';
}

async function loadPdfFile(file: File | null) {
  const selectedFile = file;
  if (!selectedFile) return;
  renderError.value = '';
  selectedPdfName.value = selectedFile.name;
  pdfBytes.value = await readFileBytes(selectedFile);
  annotations.value = [];
  selectedAnnotationId.value = null;
  await preparePdfPreview();
}

async function createBlankPdf() {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  page.drawText('PDF Studio', {
    x: 48,
    y: 780,
    size: 18,
    font,
    color: rgb(0.09, 0.41, 0.67)
  });
  renderError.value = '';
  pdfBytes.value = await doc.save();
  annotations.value = [];
  selectedPdfName.value = 'blank-document.pdf';
  await preparePdfPreview();
}

async function preparePdfPreview() {
  await nextTick();
  if (!pdfBytes.value) return;

  const renderId = ++renderSequence;
  isRendering.value = true;
  renderError.value = '';
  hasRenderedPage.value = false;

  try {
    if (!window.pdfjsLib) {
      throw new Error('PDF preview engine did not load. Refresh the page and try again.');
    }
    if (!pdfCanvas.value) {
      throw new Error('PDF preview canvas is not available.');
    }

    window.pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.js';
    pdfDocument.value = await window.pdfjsLib.getDocument({ data: copyBytes(pdfBytes.value) }).promise;
    if (renderId !== renderSequence) return;

    pageCount.value = pdfDocument.value.numPages;
    const page = await pdfDocument.value.getPage(currentPage.value);
    if (renderId !== renderSequence) return;

    const viewport = page.getViewport({ scale: zoom.value });
    const baseViewport = page.getViewport({ scale: 1 });
    const canvas = pdfCanvas.value;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Canvas rendering is not available in this browser.');
    }

    const ratio = window.devicePixelRatio || 1;
    renderedPage.value = {
      width: baseViewport.width,
      height: baseViewport.height
    };

    canvas.width = Math.floor(viewport.width * ratio);
    canvas.height = Math.floor(viewport.height * ratio);
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, viewport.width, viewport.height);

    await page.render({ canvasContext: context, viewport }).promise;
    if (renderId !== renderSequence) return;

    hasRenderedPage.value = true;
    showMessage('PDF loaded. Add fields on the page and export when ready.', 'success');
  } catch (error) {
    renderError.value = error instanceof Error ? error.message : 'Unable to preview this PDF.';
  } finally {
    isRendering.value = false;
  }
}

function handlePageClick(event: MouseEvent) {
  if (!pdfBytes.value || activeTool.value === 'select') return;

  const target = event.currentTarget as HTMLElement;
  const bounds = target.getBoundingClientRect();
  const x = (event.clientX - bounds.left) / zoom.value;
  const y = (event.clientY - bounds.top) / zoom.value;
  const base = {
    id: crypto.randomUUID(),
    x,
    y,
    page: currentPage.value
  };

  if (activeTool.value === 'text') {
    annotations.value.push({ ...base, type: 'text', value: draftText.value || 'Text', width: 180, height: 32 });
  }

  if (activeTool.value === 'comment') {
    annotations.value.push({ ...base, type: 'comment', value: draftComment.value || 'Comment', width: 220, height: 48 });
  }

  if (activeTool.value === 'image') {
    if (!currentImage.value) {
      showMessage('Choose an image first.', 'warning');
      return;
    }
    annotations.value.push({ ...base, ...currentImage.value, type: 'image', width: 160, height: 110 });
  }

  if (activeTool.value === 'signature') {
    if (!signatureImage.value) {
      showMessage('Draw and use a signature first.', 'warning');
      return;
    }
    annotations.value.push({ ...base, ...signatureImage.value, type: 'signature', width: 180, height: 64 });
  }
}

function annotationStyle(item: Annotation) {
  return {
    left: `${item.x * zoom.value}px`,
    top: `${item.y * zoom.value}px`,
    width: `${item.width * zoom.value}px`,
    minHeight: `${item.height * zoom.value}px`,
    fontSize: `${Math.max(12, 15 * zoom.value)}px`
  };
}

function annotationImageSrc(item: Annotation): string {
  return item.type === 'image' || item.type === 'signature' ? item.src : '';
}

async function loadImageFile(file: File | File[] | null) {
  const selectedFile = Array.isArray(file) ? file[0] : file;
  if (!selectedFile) return;

  currentImage.value = {
    src: URL.createObjectURL(selectedFile),
    bytes: new Uint8Array(await selectedFile.arrayBuffer()),
    mimeType: normalizeImageMimeType(selectedFile.type)
  };
  showMessage('Click the PDF to place the image.');
}

function initializeSignaturePad() {
  const canvas = signatureCanvas.value;
  if (!canvas) return;
  const context = canvas.getContext('2d');
  if (!context) return;
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = '#101828';
  context.lineWidth = 2;
  context.lineCap = 'round';
}

function startSignature(event: PointerEvent) {
  if (!signatureCanvas.value) return;
  signatureDrawing.value = true;
  const point = signaturePoint(event);
  const context = signatureCanvas.value.getContext('2d');
  if (!context) return;
  context.beginPath();
  context.moveTo(point.x, point.y);
}

function drawSignature(event: PointerEvent) {
  if (!signatureDrawing.value || !signatureCanvas.value) return;
  const point = signaturePoint(event);
  const context = signatureCanvas.value.getContext('2d');
  if (!context) return;
  context.lineTo(point.x, point.y);
  context.stroke();
}

function stopSignature() {
  signatureDrawing.value = false;
}

function signaturePoint(event: PointerEvent) {
  if (!signatureCanvas.value) return { x: 0, y: 0 };
  const bounds = signatureCanvas.value.getBoundingClientRect();
  return {
    x: event.clientX - bounds.left,
    y: event.clientY - bounds.top
  };
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
      src: dataUrl,
      bytes: new Uint8Array(await blob.arrayBuffer()),
      mimeType: 'image/png'
    };
    showMessage('Click the PDF to place the signature.');
  }, 'image/png');
}

function addParam() {
  apiParams.value.push({ id: crypto.randomUUID(), key: '', value: '' });
}

function removeParam(id: string) {
  apiParams.value = apiParams.value.filter((param) => param.id !== id);
}

async function fetchApiData() {
  apiError.value = '';
  if (!apiUrl.value) {
    apiError.value = 'Enter an API URL.';
    return;
  }

  try {
    const url = new URL(apiUrl.value);
    apiParams.value.forEach((param) => {
      if (param.key) url.searchParams.set(param.key, param.value);
    });
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Request failed with ${response.status}`);
    apiResponse.value = await response.json();
    selectedDataField.value = dataFields.value[0] || '';
    showMessage('API data loaded.');
  } catch (error) {
    apiError.value = error instanceof Error ? error.message : 'Unable to load API data.';
  }
}

function flattenObject(value: unknown, prefix = ''): string[] {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => flattenObject(entry, prefix ? `${prefix}.${index}` : String(index)));
  }
  return Object.entries(value as Record<string, unknown>).flatMap(([key, entry]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
      return flattenObject(entry, path);
    }
    return [path];
  });
}

function getFieldValue(path: string): unknown {
  return path.split('.').reduce<unknown>((current, key) => {
    if (!current || typeof current !== 'object') return undefined;
    return Array.isArray(current) ? current[Number(key)] : (current as Record<string, unknown>)[key];
  }, apiResponse.value);
}

function insertMappedField() {
  if (!selectedDataField.value) return;
  activeTool.value = 'text';
  draftText.value = String(getFieldValue(selectedDataField.value) ?? '');
  showMessage('Click the PDF to place the mapped field.');
}

function deleteAnnotation(id: string) {
  annotations.value = annotations.value.filter((item) => item.id !== id);
}

function zoomBy(amount: number) {
  zoom.value = Math.min(1.8, Math.max(0.6, Number((zoom.value + amount).toFixed(2))));
}

async function exportPdf() {
  if (!pdfBytes.value) return;

  const doc = await PDFDocument.load(pdfBytes.value);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pages = doc.getPages();
  const page = pages[currentPage.value - 1];
  const { width: pdfWidth, height: pdfHeight } = page.getSize();
  const scaleX = pdfWidth / renderedPage.value.width;
  const scaleY = pdfHeight / renderedPage.value.height;

  for (const item of annotations.value) {
    const x = item.x * scaleX;
    const y = pdfHeight - (item.y + item.height) * scaleY;
    const width = item.width * scaleX;
    const height = item.height * scaleY;

    if (item.type === 'text' || item.type === 'field') {
      page.drawText(String(item.value), {
        x,
        y: y + height - 17,
        size: 12,
        font,
        color: rgb(0.07, 0.09, 0.16),
        maxWidth: width
      });
    }

    if (item.type === 'comment') {
      page.drawRectangle({
        x,
        y,
        width,
        height,
        color: rgb(1, 0.96, 0.67),
        borderColor: rgb(0.82, 0.47, 0.07),
        borderWidth: 1
      });
      page.drawText(String(item.value), {
        x: x + 8,
        y: y + height - 17,
        size: 10,
        font,
        color: rgb(0.48, 0.26, 0.02),
        maxWidth: width - 16
      });
    }

    if (item.type === 'image' || item.type === 'signature') {
      const embedded = item.mimeType === 'image/jpeg'
        ? await doc.embedJpg(item.bytes)
        : await doc.embedPng(item.bytes);
      page.drawImage(embedded, { x, y, width, height });
    }
  }

  const editedPdf = await doc.save();
  const editedPdfBuffer = editedPdf.buffer.slice(
    editedPdf.byteOffset,
    editedPdf.byteOffset + editedPdf.byteLength
  ) as ArrayBuffer;
  const blob = new Blob([editedPdfBuffer], { type: 'application/pdf' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'edited-document.pdf';
  link.click();
  URL.revokeObjectURL(link.href);
  showMessage('PDF exported.');
}

function normalizeImageMimeType(mimeType: string): ImageMimeType {
  return mimeType === 'image/jpeg' ? 'image/jpeg' : 'image/png';
}

function copyBytes(bytes: Uint8Array): Uint8Array {
  const copiedBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  return new Uint8Array(copiedBuffer);
}

function readFileBytes(file: File): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('Unable to read the selected file.'));
    reader.onload = () => {
      if (!(reader.result instanceof ArrayBuffer)) {
        reject(new Error('Unable to read the selected file as binary data.'));
        return;
      }
      resolve(new Uint8Array(reader.result));
    };
    reader.readAsArrayBuffer(file);
  });
}

</script>

<style scoped>
.app-shell {
  min-height: 100vh;
}

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

.document-actions .v-btn {
  flex: 1;
}

.tool-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  margin-bottom: 14px;
  width: 100%;
}

.tool-grid :deep(.v-btn) {
  min-width: 0;
}

.signature-tool {
  display: grid;
  gap: 10px;
}

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

.top-toolbar {
  border-bottom: 1px solid #d9e1ec;
  position: sticky;
  top: 0;
  z-index: 5;
}

.zoom-slider {
  max-width: 220px;
}

.workspace {
  align-items: flex-start;
  display: flex;
  justify-content: center;
  min-height: calc(100vh - 64px);
  overflow: auto;
  padding: 28px;
}

.empty-state {
  align-items: center;
  color: #475467;
  display: flex;
  flex-direction: column;
  gap: 14px;
  justify-content: center;
  min-height: 64vh;
  max-width: 540px;
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

.page-wrap {
  flex: 0 0 auto;
}

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

.page-placeholder span {
  font-size: 0.82rem;
}

.annotation {
  align-items: flex-start;
  border: 1px solid transparent;
  cursor: pointer;
  display: flex;
  gap: 6px;
  line-height: 1.3;
  overflow: hidden;
  padding: 4px 6px;
  position: absolute;
  word-break: break-word;
}

.annotation:hover,
.annotation.selected {
  border-color: #1769aa;
  outline: 2px solid rgb(23 105 170 / 14%);
}

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
  position: absolute;
  right: -10px;
  top: -10px;
}

@media (max-width: 900px) {
  .side-panel {
    width: 280px !important;
  }

  .workspace {
    padding: 18px;
  }
}
</style>
