import ViewerCanvas from './components/ViewerCanvas'
import './App.css'

function App() {
  const orbitControlsEnabled = true

  return (
    <main className="app-shell">
      <header className="top-toolbar" aria-label="toolbar placeholder">
        <div>
          <p className="eyebrow">BIM Lightweight Viewer MVP</p>
          <h1>BIM 輕量檢視器</h1>
        </div>
        <div className="toolbar-actions">
          <button type="button" disabled>
            IFC Upload (Step 4)
          </button>
          <button type="button" disabled>
            Move / Rotate / Scale (Step 10)
          </button>
          <span className="status-pill">Step 3</span>
        </div>
      </header>

      <section className="workspace-layout">
        <section className="viewer-panel" aria-label="3D viewer area">
          <div className="viewer-head">
            <h2>3D Viewer</h2>
            <p>OrbitControls 已啟用：左鍵旋轉、右鍵平移、滾輪縮放。</p>
          </div>
          <div className="viewer-canvas-wrapper">
            <ViewerCanvas orbitEnabled={orbitControlsEnabled} />
          </div>
        </section>

        <aside className="sidebar-panel" aria-label="sidebar placeholder">
          <h2>Sidebar Placeholder</h2>
          <ul>
            <li>Current model: none</li>
            <li>Selected object: none</li>
            <li>Transform mode: disabled</li>
            <li>Orbit controls: enabled</li>
          </ul>
          <p>下一步會進入 Step 4，先完成 IFC 檔案上傳 UI 與基本狀態顯示。</p>
        </aside>
      </section>
    </main>
  )
}

export default App
