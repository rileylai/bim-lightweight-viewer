import './App.css'

function App() {
  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">AI Native BIM Demo</p>
          <h1>BIM 輕量檢視器</h1>
        </div>
        <span className="status-pill">Step 1</span>
      </header>

      <section className="viewer-placeholder" aria-label="3D viewer placeholder">
        <div className="placeholder-grid">
          <div className="placeholder-cube" />
        </div>
        <div className="placeholder-copy">
          <h2>3D Canvas Placeholder</h2>
          <p>下一步會建立基礎 React 版面與 3D canvas。</p>
        </div>
      </section>

      <section className="milestone-list" aria-label="MVP milestones">
        <article>
          <h2>第一階段 MVP</h2>
          <p>IFC 載入、選取、高亮、TransformControls、project JSON 儲存與還原。</p>
        </article>
        <article>
          <h2>第二階段擴充</h2>
          <p>GLB / GLTF 匯入、刪除、狀態保存、UI polish 與交件文件整理。</p>
        </article>
      </section>
    </main>
  )
}

export default App
