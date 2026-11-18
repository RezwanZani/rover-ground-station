export type Motor = {
  name: string;
  current_a: number;
  temp_c: number;
};

export type ConnectionStatus = {
  active_channel?: "DUAL_ACTIVE" | "UDP" | "XBEE" | "OFFLINE";
  last_channel?: string;
  xbee_connected?: boolean;
  xbee_port?: string;
  xbee_rx_pkts?: number;
  gps_connected?: boolean;
  gps_fix?: string;
  rtcm_received?: boolean;
  rtcm_count?: number;
  rtcm_age_s?: number | null;
  master_connected?: boolean;
  master_port?: string;
};

export type ArmState = {
  act1: number;
  act2: number;
  act3: number;
  wrist: number;
  gripper: number;
};

export type CmdVel = {
  linear_x: number;
  angular_z: number;
};

export type Telemetry = {
  radio: { tx_active: boolean; rx_ping_ms: number | null; link_quality?: number; port?: string; available_ports?: string[] };
  battery: { voltage: number };
  rover_state: { active_flag: string; mission_time?: string };
  gps: { lat: number; lon: number; heading: number };
  velocity: { speed_mps: number; direction_deg: number };
  imu: { pitch: number; roll: number; yaw: number };
  joy: { axis_x: number; axis_y: number; deadband?: number; connected?: boolean; name?: string };
  motors: Motor[];
  camera: { primary_url?: string; secondary_url?: string };
  connection?: ConnectionStatus;
  cmd_vel?: CmdVel;
  arm?: ArmState;
};
