import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import DocumentList from '@/pages/DocumentList';
import Practice from '@/pages/Practice';
import Result from '@/pages/Result';

export default function App() {
  return (
    <ConfigProvider locale={zhCN}>
      <BrowserRouter>
        <div className="app">
          <Routes>
            <Route path="/" element={<DocumentList />} />
            <Route path="/practice/:id" element={<Practice />} />
            <Route path="/result/:id" element={<Result />} />
          </Routes>
        </div>
      </BrowserRouter>
    </ConfigProvider>
  );
}
