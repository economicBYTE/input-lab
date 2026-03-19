import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Button, Statistic, Row, Col, Tag, Space, Typography } from 'antd';
import { usePracticeStore } from '@/stores/practiceStore';
import { practiceRecordService } from '@/services/db';

const { Title } = Typography;

export default function Result() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [saved, setSaved] = useState(false);

  const {
    documentId,
    content,
    startTime,
    errorCount,
    totalKeystrokes,
    errorChars,
    reset,
  } = usePracticeStore();

  const endTime = Date.now();
  const duration = startTime ? endTime - startTime : 0;
  const durationSeconds = Math.round(duration / 1000);
  const minutes = Math.floor(durationSeconds / 60);
  const seconds = durationSeconds % 60;

  const kpm = startTime && duration > 0
    ? Math.round(content.length / (duration / 60000))
    : 0;

  const errorRate = totalKeystrokes > 0
    ? Math.round((errorCount / totalKeystrokes) * 1000) / 10
    : 0;

  // 保存练习记录
  useEffect(() => {
    if (!saved && documentId && startTime) {
      practiceRecordService.save({
        documentId,
        startTime,
        endTime,
        totalChars: content.length,
        errorCount,
        kpm,
        errorRate,
        errorChars,
      });
      setSaved(true);
    }
  }, [saved, documentId, startTime, endTime, content.length, errorCount, kpm, errorRate, errorChars]);

  const handleRetry = () => {
    reset();
    navigate(`/practice/${id}`);
  };

  const handleBack = () => {
    reset();
    navigate('/');
  };

  return (
    <div className="result-container">
      <Card className="result-card">
        <Title level={2} style={{ textAlign: 'center', marginBottom: 32 }}>
          练习完成
        </Title>

        <Row gutter={[32, 32]}>
          <Col xs={12} sm={6}>
            <Statistic
              title="总时长"
              value={`${minutes}:${seconds.toString().padStart(2, '0')}`}
            />
          </Col>
          <Col xs={12} sm={6}>
            <Statistic title="KPM" value={kpm} suffix="键/分" />
          </Col>
          <Col xs={12} sm={6}>
            <Statistic title="错误率" value={errorRate} suffix="%" />
          </Col>
          <Col xs={12} sm={6}>
            <Statistic title="总字符" value={content.length} />
          </Col>
        </Row>

        {errorChars.length > 0 && (
          <div style={{ marginTop: 32 }}>
            <Title level={5}>错误字符</Title>
            <Space wrap>
              {errorChars.map((char, i) => (
                <Tag key={i} color="error" style={{ fontSize: 16, padding: '4px 12px' }}>
                  {char === ' ' ? '空格' : char === '\n' ? '换行' : char === '\t' ? 'Tab' : char}
                </Tag>
              ))}
            </Space>
          </div>
        )}

        <div style={{ marginTop: 48, textAlign: 'center' }}>
          <Space size="large">
            <Button type="primary" size="large" onClick={handleRetry}>
              再练一次
            </Button>
            <Button size="large" onClick={handleBack}>
              返回列表
            </Button>
          </Space>
        </div>
      </Card>
    </div>
  );
}
