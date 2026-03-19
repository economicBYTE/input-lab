import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { List, Card, Empty, Spin, Typography } from 'antd';
import { useDocumentStore } from '@/stores/documentStore';

const { Text, Paragraph } = Typography;

export default function DocumentList() {
  const navigate = useNavigate();
  const { documents, loading, fetchDocuments } = useDocumentStore();

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  if (loading) {
    return (
      <div className="center-container">
        <Spin size="large" />
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="center-container">
        <Empty description="暂无文档，请先添加练习内容" />
      </div>
    );
  }

  return (
    <div className="document-list">
      <Typography.Title level={3} style={{ marginBottom: 24 }}>
        选择文档开始练习
      </Typography.Title>
      <List
        grid={{ gutter: 16, xs: 1, sm: 2, md: 2, lg: 3, xl: 3 }}
        dataSource={documents}
        renderItem={(doc) => (
          <List.Item>
            <Card
              hoverable
              onClick={() => navigate(`/practice/${doc.id}`)}
              className="document-card"
            >
              <Card.Meta
                title={doc.title}
                description={
                  <>
                    {doc.description && (
                      <Paragraph ellipsis={{ rows: 2 }} type="secondary">
                        {doc.description}
                      </Paragraph>
                    )}
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {doc.content.length} 字符
                    </Text>
                  </>
                }
              />
            </Card>
          </List.Item>
        )}
      />
    </div>
  );
}
