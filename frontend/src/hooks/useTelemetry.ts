import { useState, useEffect } from 'react';
import useWebSocket from 'react-use-websocket';

const WS_URL = 'ws://localhost:8765';

export interface TelemetryData {
  timestamp: number;
  joy: {
    axis_x: number;
    axis_y: number;
  };
  radio: {
    tx_active: boolean;
    rx_ping_ms: number;
  };
  rover_state: {
    active_flag: number;
    battery_v?: number;
    pitch?: number;
    roll?: number;
    yaw?: number;
    gps?: { lat: number, lng: number };
    motors?: Array<{ current: number, temp: number }>;
  };
}

export function useTelemetry() {
  const [telemetry, setTelemetry] = useState<TelemetryData | null>(null);

  const { sendJsonMessage, lastJsonMessage, readyState } = useWebSocket(WS_URL, {
    share: true,
    shouldReconnect: () => true,
    reconnectInterval: 1000,
  });

  useEffect(() => {
    if (lastJsonMessage) {
      setTelemetry(lastJsonMessage as TelemetryData);
    }
  }, [lastJsonMessage]);

  const sendHardwareTest = (testId: number) => {
    sendJsonMessage({
      action: "TRIGGER_TEST",
      test_id: testId,
      timeout_ms: 3000,
      mode: "test",
      joint: testId
    });
  };

  return {
    telemetry,
    connected: readyState === 1,
    sendHardwareTest
  };
}
