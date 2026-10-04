export type Motor = {
  name: string;
  current_a: number;
  temp_c: number;
};

export type Telemetry = {
  radio: { tx_active: boolean; rx_ping_ms: number; link_quality?: number; port?: string; available_ports?: string[] };
  battery: { voltage: number };
  rover_state: { active_flag: string; mission_time?: string };
  gps: { lat: number; lon: number; heading: number };
  velocity: { speed_mps: number; direction_deg: number };
  imu: { pitch: number; roll: number; yaw: number };
  joy: { axis_x: number; axis_y: number; deadband?: number; connected?: boolean; name?: string };
  motors: Motor[];
  camera: { primary_url?: string; secondary_url?: string };
};
