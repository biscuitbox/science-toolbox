// 밸런싱 로봇 - 자동 튜닝판
// Arduino UNO + MOEBIUS UNO Motor&Servo 쉴드 + JGB37-520 엔코더 모터 2개 + MPU6050 + HC-05/06
//
// 자동 튜닝(a 명령)
//   1) 실로 로봇을 들어 바퀴를 바닥에서 띄운 채 a 전송 → 바퀴가 앞뒤로 돌며 최소 출력(m)을 잼
//   2) "내려놓으세요" 메시지가 나오면 바닥에 똑바로 세우고, 실은 느슨하게(넘어질 때만 잡도록)
//   3) 로봇이 스스로 균형 각도(s) → p·d 게인을 찾고 EEPROM에 저장한 뒤 그대로 균형을 잡음
//   4) "자동 튜닝 끝" 이 나오면 실을 천천히 놓기
//   바닥이 바뀌면 그 바닥에서 a를 다시 실행하세요. 약 40초 걸려요.
//
// 연결은 balance_uno.ino와 같아요.
//  - 왼쪽 모터 M1 (PCA9685 6·7번, 엔코더 A=D3 B=D2) / 오른쪽 모터 M2 (4·5번, A=D6 B=D4)
//  - MPU6050 IIC 단자, 보드는 납작하게 X축 화살표가 앞쪽
//  - HC-05/06 UART 단자 (코드 올릴 때는 뽑기)
//
// 명령 (9600bps, 줄바꿈 전송)
//   a 자동 튜닝 시작   q 자동 튜닝 중단
//   p i d s m x : 각도 제어   v k : 속도·위치 제어   y : 회전 잡기(메카넘)
//   w 저장   r 기본값으로   g 모터 켜기/끄기   t 모터·엔코더 시험   ? 현재 값
//   j앞뒤,회전 : 조종 (각각 -100~100, 예: j60,-20). 0.4초 동안 안 오면 멈춤. 폰 웹앱 조이스틱이 보내는 명령
//
// 폰 웹앱: 과학 도구상자 → 메이커 → 밸런싱 봇 리모컨 (안드로이드 크롬)

#include <Wire.h>
#include <EEPROM.h>

// ===== 바퀴 종류 =====
const bool MECANUM = true;   // 메카넘휠이면 true, 일반 고무바퀴면 false

// ===== 방향 보정 (t 명령으로 확인) =====
int ANGLE_SIGN = 1;
int LEFT_DIR   = 1;
int RIGHT_DIR  = -1;
int LEFT_ENC   = 1;
int RIGHT_ENC  = -1;
int YAW_SIGN   = 1;

// ===== 튜닝 값 (자동 튜닝 결과가 여기 덮어써짐) =====
struct Settings {
  uint16_t magic;
  float Kp, Ki, Kd, sp, Kv, Kx, Ky;
  int16_t minPwm, maxPwm;
};
const uint16_t MAGIC = 0xB417;
Settings S;

void defaults() {
  S.magic = MAGIC;
  S.Kp = MECANUM ? 10.0 : 12.0;
  S.Ki = 0.0;
  S.Kd = MECANUM ? 0.25 : 0.3;
  S.sp = 0.0;
  S.Kv = 0.0;
  S.Kx = 0.0;
  S.Ky = 0.0;
  S.minPwm = 30;
  S.maxPwm = 255;
}

// ===== 고정 상수 =====
const float FALL_ANGLE = 40.0, RESUME_ANGLE = 5.0, SPEED_TILT_MAX = 8.0;
const float TUNE_ABORT_ANGLE = 25.0;     // 자동 튜닝 중 이 각도를 넘으면 실이 잡은 것으로 보고 중단
const unsigned long LOOP_US = 5000;
const long BAUD = 9600;
const float COUNTS_PER_REV = 11.0 * 30.0 * 4.0;
const float COMP_ALPHA = MECANUM ? 0.985 : 0.98;
const float D_FILTER = MECANUM ? 0.5 : 1.0;
const int YAW_MAX = 60;
const float DRIVE_SPEED_MAX = 1.2;   // 조종 최고 속도 (바퀴 회전/초, 65mm 바퀴면 약 0.25m/s)
const float DRIVE_ACCEL = 1.5;       // 속도를 바꾸는 빠르기 (회전/초²)
const int TURN_PWM_MAX = 45;         // 제자리 회전 최대 출력
const float DRIVE_KV_MIN = 1.0;      // 조종할 때 v가 0이면 이 값을 씀

// 자동 튜닝용 바깥 루프 (튜닝 중 로봇이 제자리를 지키게)
const float TUNE_KV = 1.5, TUNE_KX = 0.8;
const float TUNE_KD_TEST = 0.12;          // p 탐색 중 진동이 드러나도록 작게
const int   TUNE_MAXPWM = 200;            // 튜닝 중 최대 출력 제한

const uint8_t PCA_ADDR = 0x40, PCA_FIRST_CH = 4, MPU_ADDR = 0x68;

// ===== 내부 변수 =====
float gyroOffsetY = 0, gyroOffsetZ = 0, lastGz = 0;
float angle = 0, gyroRate = 0, gyroD = 0, yawRate = 0;
float integral = 0, output = 0;
bool fallen = true, enabled = true;
unsigned long lastMicros = 0, lastPrint = 0;

volatile long encL = 0, encR = 0;
volatile uint8_t prevPD = 0;
long lastEncL = 0, lastEncR = 0, posRef = 0;
float wheelSpeed = 0, wheelPos = 0;
float driveCmd = 0, turnCmd = 0, driveSpd = 0;   // 조종 명령과 지금 따라가는 목표 속도
unsigned long lastDriveMs = 0;

char lineBuf[24];
uint8_t lineLen = 0;

// 자동 튜닝 상태
enum Mode : uint8_t { RUN, T_DEAD, T_PLACE, T_SETTLE, T_SP, T_GAIN, T_VERIFY, T_FINAL };
Mode mode = RUN;
unsigned long phaseStart = 0;   // ms
uint16_t tick = 0;               // 단계 안 제어 주기 카운트
float tKp, tKd;                  // 튜닝 중 쓰는 게인
float angSum = 0, spdSum = 0; uint16_t nSum = 0;
// 진동 측정
float oscMean = 0, oscMin = 0, oscMax = 0; int8_t oscSide = 0; uint16_t oscCross = 0;
float Ku = 0, Tu = 0;
uint8_t verifyTry = 0;
int deadF = 0, deadB = 0;
long encStartL = 0, encStartR = 0;

// ---------- 엔코더 ----------
const int8_t QDEC[16] = {0, 1, -1, 0, -1, 0, 0, 1, 1, 0, 0, -1, 0, -1, 1, 0};
ISR(PCINT2_vect) {
  uint8_t pd = PIND;
  uint8_t lp = (((prevPD >> 3) & 1) << 1) | ((prevPD >> 2) & 1);
  uint8_t ln = (((pd >> 3) & 1) << 1) | ((pd >> 2) & 1);
  uint8_t rp = (((prevPD >> 6) & 1) << 1) | ((prevPD >> 4) & 1);
  uint8_t rn = (((pd >> 6) & 1) << 1) | ((pd >> 4) & 1);
  encL += QDEC[(lp << 2) | ln];
  encR += QDEC[(rp << 2) | rn];
  prevPD = pd;
}
void initEncoders() {
  pinMode(2, INPUT_PULLUP); pinMode(3, INPUT_PULLUP);
  pinMode(4, INPUT_PULLUP); pinMode(6, INPUT_PULLUP);
  prevPD = PIND;
  PCMSK2 |= _BV(PCINT18) | _BV(PCINT19) | _BV(PCINT20) | _BV(PCINT22);
  PCICR |= _BV(PCIE2);
}
void readEncoders(long &l, long &r) {
  noInterrupts(); l = encL; r = encR; interrupts();
  l *= LEFT_ENC; r *= RIGHT_ENC;
}

// ---------- PCA9685 ----------
bool pcaWrite(uint8_t reg, uint8_t val) {
  Wire.beginTransmission(PCA_ADDR); Wire.write(reg); Wire.write(val);
  return Wire.endTransmission() == 0;
}
bool initPCA() {
  if (!pcaWrite(0x00, 0x10)) return false;
  pcaWrite(0xFE, 3);
  pcaWrite(0x01, 0x04);
  pcaWrite(0x00, 0x20);
  delay(2);
  pcaWrite(0x00, 0xA0);
  pcaWrite(0xFD, 0x10);
  return true;
}
void putChannel(uint16_t v) {
  if (v == 0) { Wire.write(0); Wire.write(0); Wire.write(0); Wire.write(0x10); }
  else if (v >= 4095) { Wire.write(0); Wire.write(0x10); Wire.write(0); Wire.write(0); }
  else { Wire.write(0); Wire.write(0); Wire.write(v & 0xFF); Wire.write(v >> 8); }
}
int curMaxPwm() { return (mode == RUN) ? S.maxPwm : min((int)S.maxPwm, TUNE_MAXPWM); }
void setMotors(int left, int right) {
  int mx = curMaxPwm();
  left = constrain(left, -mx, mx) * LEFT_DIR;
  right = constrain(right, -mx, mx) * RIGHT_DIR;
  uint16_t lv = (uint16_t)abs(left) * 16, rv = (uint16_t)abs(right) * 16;
  if (abs(left) >= 255) lv = 4095;
  if (abs(right) >= 255) rv = 4095;
  Wire.beginTransmission(PCA_ADDR);
  Wire.write(0x06 + 4 * PCA_FIRST_CH);
  putChannel(right > 0 ? rv : 0);
  putChannel(right < 0 ? rv : 0);
  putChannel(left > 0 ? lv : 0);
  putChannel(left < 0 ? lv : 0);
  Wire.endTransmission();
}
int withDeadzone(float out) {
  if (out > 0.5) return S.minPwm + (int)out;
  if (out < -0.5) return -S.minPwm + (int)out;
  return 0;
}
void drive(float out, float turn) { setMotors(withDeadzone(out + turn), withDeadzone(out - turn)); }

// ---------- MPU6050 ----------
void mpuWrite(uint8_t reg, uint8_t val) {
  Wire.beginTransmission(MPU_ADDR); Wire.write(reg); Wire.write(val); Wire.endTransmission();
}
bool readMPU(float &ax, float &az, float &gy) {
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x3B);
  if (Wire.endTransmission(false) != 0) return false;
  if (Wire.requestFrom(MPU_ADDR, (uint8_t)14) != 14) return false;
  int16_t raw[7];
  for (int i = 0; i < 7; i++) { uint8_t hi = Wire.read(); uint8_t lo = Wire.read(); raw[i] = (int16_t)((hi << 8) | lo); }
  ax = raw[0] / 16384.0; az = raw[2] / 16384.0; gy = raw[5] / 131.0; lastGz = raw[6] / 131.0;
  return true;
}
float accelAngle(float ax, float az) { return atan2(-ax, az) * RAD_TO_DEG * ANGLE_SIGN; }
void calibrateGyro() {
  float sum = 0, sumZ = 0, ax, az, gy; int n = 0;
  for (int i = 0; i < 500; i++) { if (readMPU(ax, az, gy)) { sum += gy; sumZ += lastGz; n++; } delay(2); }
  gyroOffsetY = n ? sum / n : 0; gyroOffsetZ = n ? sumZ / n : 0;
}

// ---------- 저장 ----------
void saveSettings() { S.magic = MAGIC; EEPROM.put(0, S); }
void loadSettings() { EEPROM.get(0, S); if (S.magic != MAGIC) defaults(); }

// ---------- 출력 ----------
void printValues() {
  Serial.print(F("Kp=")); Serial.print(S.Kp, 2);
  Serial.print(F(" Ki=")); Serial.print(S.Ki, 2);
  Serial.print(F(" Kd=")); Serial.print(S.Kd, 3);
  Serial.print(F(" s=")); Serial.print(S.sp, 2);
  Serial.print(F(" m=")); Serial.print(S.minPwm);
  Serial.print(F(" x=")); Serial.print(S.maxPwm);
  Serial.print(F(" v=")); Serial.print(S.Kv, 2);
  Serial.print(F(" k=")); Serial.print(S.Kx, 2);
  Serial.print(F(" y=")); Serial.print(S.Ky, 2);
  Serial.println(enabled ? F(" ON") : F(" OFF"));
}
void printHelp() {
  Serial.println(F("a 자동튜닝  q 중단  w 저장  r 기본값  g 모터 켜기/끄기  t 시험  ? 현재값"));
  Serial.println(F("p i d s m x v k y : 값 직접 바꾸기 (예: p14 s-1.5)"));
}

// ---------- 모터·엔코더 시험 ----------
void motorTest() {
  bool was = enabled; enabled = false;
  Serial.println(F("시험: 바퀴를 띄우세요. 왼쪽 → 오른쪽 순서로 1초씩 앞으로 돌립니다."));
  delay(1500);
  long l0, r0, l1, r1;
  readEncoders(l0, r0); setMotors(120, 0); delay(1000); setMotors(0, 0); delay(300); readEncoders(l1, r1);
  Serial.print(F("왼쪽 엔코더: ")); Serial.println(l1 - l0);
  readEncoders(l0, r0); setMotors(0, 120); delay(1000); setMotors(0, 0); delay(300); readEncoders(l1, r1);
  Serial.print(F("오른쪽 엔코더: ")); Serial.println(r1 - r0);
  Serial.println(F("바퀴가 앞으로 돌았고 두 값이 모두 + 이면 정상이에요."));
  enabled = was; lastMicros = micros();
}

// ---------- 자동 튜닝 ----------
void startPhase(Mode m) { mode = m; phaseStart = millis(); tick = 0; angSum = 0; spdSum = 0; nSum = 0; }
void oscReset() { oscMean = angle; oscMin = 0; oscMax = 0; oscSide = 0; oscCross = 0; }
void oscUpdate() {
  oscMean += (angle - oscMean) * 0.01;            // 약 0.5초 평균
  float e = angle - oscMean;
  if (e < oscMin) oscMin = e;
  if (e > oscMax) oscMax = e;
  if (e > 0.25 && oscSide != 1) { if (oscSide != 0) oscCross++; oscSide = 1; }
  if (e < -0.25 && oscSide != -1) { if (oscSide != 0) oscCross++; oscSide = -1; }
}
float oscAmp() { return (oscMax - oscMin) * 0.5; }

void autotuneStart() {
  enabled = true;
  Serial.println(F("[자동 튜닝] 약 40초 걸려요. 아무 키나 보내면 중단."));
  Serial.println(F("[1/5] 최소 출력 찾는 중... 실로 들어서 바퀴를 바닥에서 띄워 두세요."));
  long l, r; readEncoders(l, r); encStartL = l; encStartR = r;
  deadF = deadB = 0;
  driveCmd = turnCmd = driveSpd = 0;
  startPhase(T_DEAD);
}
void autotuneAbort(const __FlashStringHelper *why) {
  setMotors(0, 0);
  mode = RUN;
  enabled = false;
  integral = 0;
  loadSettings();   // 튜닝 전 값으로 되돌림
  Serial.print(F("[자동 튜닝 중단] ")); Serial.println(why);
  Serial.println(F("모터를 껐어요. 로봇을 다시 세우고 g로 켜거나 a로 다시 시작하세요."));
}

// 균형 제어 한 번 계산 (게인을 인자로 받음)
float balanceOut(float Kp, float Kd, float Kv, float Kx, float dt) {
  float lean = constrain(Kv * (wheelSpeed - driveSpd) + Kx * wheelPos, -SPEED_TILT_MAX, SPEED_TILT_MAX);
  float err = angle - (S.sp - lean);
  integral += err * dt;
  integral = constrain(integral, -100, 100);
  return Kp * err + S.Ki * integral + Kd * gyroD;
}

void autotuneStep(float dt, long l, long r) {
  unsigned long el = millis() - phaseStart;
  tick++;
  if (fabs(angle - S.sp) > TUNE_ABORT_ANGLE && mode != T_DEAD && mode != T_PLACE) {
    autotuneAbort(F("크게 기울었어요. 실이 너무 느슨하거나, p를 올려야 할 수 있어요."));
    return;
  }

  switch (mode) {
    case T_DEAD: {
      // 앞으로, 뒤로 출력을 천천히 올리며 바퀴가 처음 움직이는 출력을 찾음 (1.2초씩)
      bool fwd = (deadF == 0);
      int pwm = min(150, (int)(tick / 2));
      long dl = labs(l - encStartL), dr = labs(r - encStartR);
      setMotors(fwd ? pwm : -pwm, fwd ? pwm : -pwm);
      if ((dl > 8 && dr > 8) || pwm >= 150) {
        setMotors(0, 0);
        if (fwd) { deadF = pwm; delay(400); readEncoders(l, r); encStartL = l; encStartR = r; tick = 0; }
        else {
          deadB = pwm;
          // 공중에서 잰 값이라 바닥 위보다 조금 작게 나옴 → 0.9배만 적용
          S.minPwm = constrain((int)((deadF + deadB) * 0.5 * 0.9), 10, 120);
          Serial.print(F("  최소 출력 m = ")); Serial.println(S.minPwm);
          if (deadF >= 150 || deadB >= 150) Serial.println(F("  (바퀴가 거의 안 움직였어요. 배터리와 모터 배선을 확인하세요)"));
          Serial.println(F("[2/5] 이제 바닥에 똑바로 세워 주세요. 실은 느슨하게! 바로 서면 자동으로 시작해요."));
          startPhase(T_PLACE);
        }
      }
      return;
    }
    case T_PLACE: {
      // 내려놓을 시간 3초를 준 뒤, 0.5초 동안 똑바로(각도 8도 이내) 서 있으면 균형 시작
      setMotors(0, 0);
      if (el < 3000 || fabs(angle - S.sp) > 8.0 || fabs(gyroRate) > 30) { tick = 0; return; }
      if (tick > 100) {
        integral = 0; posRef = (l + r) / 2; wheelPos = 0; wheelSpeed = 0; gyroD = gyroRate;
        Serial.println(F("  균형 각도 찾는 중... (로봇이 제자리에서 버티게 둬요)"));
        startPhase(T_SETTLE);
      }
      return;
    }
    case T_SETTLE:   // 2초 동안 기본 게인으로 서서 안정시킨 뒤 측정
    case T_SP: {
      output = balanceOut(S.Kp, S.Kd, TUNE_KV, TUNE_KX, dt);
      drive(output, 0);
      if (mode == T_SETTLE) { if (el > 2000) startPhase(T_SP); return; }
      angSum += angle; spdSum += wheelSpeed; nSum++;
      if (el > 4000) {
        float a = angSum / nSum, sv = spdSum / nSum;
        S.sp = a;   // 제자리에서 버틸 때의 평균 각도 = 균형 각도
        Serial.print(F("  균형 각도 s = ")); Serial.println(S.sp, 2);
        if (fabs(sv) > 0.3) Serial.println(F("  (계속 한쪽으로 움직였어요. 실이 당겨지지 않았는지 확인하세요)"));
        Serial.println(F("[3/5] p 게인 찾는 중... (조금씩 떨리기 시작하면 정상이에요)"));
        tKp = max(5.0f, S.Kp * 0.7f); tKd = TUNE_KD_TEST;
        oscReset(); startPhase(T_GAIN);
      }
      return;
    }
    case T_GAIN: {
      output = balanceOut(tKp, tKd, TUNE_KV, TUNE_KX, dt);
      drive(output, 0);
      oscUpdate();
      if (el > 1200) {
        // 마지막 0.8초 동안 진폭 1.2도 이상, 3번 이상 방향이 바뀌면 진동 시작으로 봄
        float amp = oscAmp();
        Serial.print(F("  p=")); Serial.print(tKp, 1); Serial.print(F(" 진폭=")); Serial.print(amp, 2);
        Serial.print(F(" 교차=")); Serial.println(oscCross);
        if ((amp > 1.2 && oscCross >= 3) || tKp >= 45) {
          Ku = tKp;
          Tu = oscCross >= 2 ? (2.0 * 0.8 / oscCross) : 0.3;
          S.Kp = constrain(0.6 * Ku, 4.0, 40.0);
          S.Kd = constrain(0.6 * Ku * Tu / 8.0, 0.08, 2.0);
          Serial.print(F("  떨림 시작 p=")); Serial.print(Ku, 1); Serial.print(F(" 주기=")); Serial.print(Tu, 2);
          Serial.print(F("초 → p=")); Serial.print(S.Kp, 1); Serial.print(F(" d=")); Serial.println(S.Kd, 3);
          Serial.println(F("[4/5] 확인 중..."));
          verifyTry = 0; oscReset(); startPhase(T_VERIFY);
        } else {
          tKp += 1.5; phaseStart = millis();
          oscMin = oscMax = 0; oscCross = 0; oscSide = 0;   // 다음 단계는 처음 0.4초 버리고 측정
        }
      } else if (el < 400) { oscMin = oscMax = 0; oscCross = 0; oscSide = 0; }
      return;
    }
    case T_VERIFY: {
      output = balanceOut(S.Kp, S.Kd, TUNE_KV, TUNE_KX, dt);
      drive(output, 0);
      oscUpdate();
      if (el < 1000) { oscMin = oscMax = 0; oscCross = 0; oscSide = 0; return; }
      if (el > 3000) {
        float amp = oscAmp();
        Serial.print(F("  흔들림 진폭=")); Serial.println(amp, 2);
        if (amp > 1.0 && verifyTry < 3) {
          S.Kp *= 0.85; S.Kd *= 1.15; verifyTry++;
          Serial.print(F("  아직 떨려서 p=")); Serial.print(S.Kp, 1); Serial.print(F(" d=")); Serial.println(S.Kd, 3);
          oscReset(); startPhase(T_VERIFY);
        } else {
          Serial.println(F("[5/5] 새 게인으로 균형 각도 다시 확인 중..."));
          startPhase(T_FINAL);
        }
      }
      return;
    }
    case T_FINAL: {
      output = balanceOut(S.Kp, S.Kd, TUNE_KV, TUNE_KX, dt);
      drive(output, 0);
      if (el > 1000) { angSum += angle; nSum++; }
      if (el > 4000) {
        S.sp = angSum / nSum;
        if (S.Kv == 0) S.Kv = TUNE_KV;   // 실을 놓은 뒤에도 제자리를 지키도록 속도·위치 제어 켜기
        if (S.Kx == 0) S.Kx = TUNE_KX;
        saveSettings();
        mode = RUN; fallen = false;
        Serial.println(F("[자동 튜닝 끝] 저장했어요. 이제 실을 천천히 놓아도 돼요."));
        printValues();
      }
      return;
    }
    default: return;
  }
}

// ---------- 명령 ----------
void handleCommand(char *line) {
  char c = tolower(line[0]);
  float v = atof(line + 1);
  if (c == 'j') {   // 조종: 튜닝 중이면 무시 (튜닝을 멈추지 않음)
    if (mode != RUN) return;
    char *comma = strchr(line, ',');
    driveCmd = constrain(atof(line + 1), -100, 100);
    turnCmd = comma ? constrain(atof(comma + 1), -100, 100) : 0;
    lastDriveMs = millis();
    return;
  }
  if (mode != RUN) { autotuneAbort(F("명령을 받아서 멈췄어요.")); return; }
  switch (c) {
    case 'a': autotuneStart(); return;
    case 'q': return;
    case 'p': S.Kp = v; break;
    case 'i': S.Ki = v; integral = 0; break;
    case 'd': S.Kd = v; break;
    case 's': S.sp = v; break;
    case 'm': S.minPwm = constrain((int)v, 0, 200); break;
    case 'x': S.maxPwm = constrain((int)v, 0, 255); break;
    case 'v': S.Kv = v; break;
    case 'k': S.Kx = v; break;
    case 'y': S.Ky = v; break;
    case 'w': saveSettings(); Serial.println(F("저장했어요.")); break;
    case 'r': defaults(); saveSettings(); Serial.println(F("기본값으로 되돌렸어요.")); break;
    case 'g': enabled = !enabled; integral = 0; posRef = (lastEncL + lastEncR) / 2; break;
    case 't': motorTest(); return;
    case '?': break;
    default: printHelp(); return;
  }
  printValues();
}
void readSerial() {
  while (Serial.available()) {
    char ch = Serial.read();
    if (ch == '\n' || ch == '\r') {
      if (lineLen > 0) { lineBuf[lineLen] = 0; handleCommand(lineBuf); lineLen = 0; }
    } else if (lineLen < sizeof(lineBuf) - 1) lineBuf[lineLen++] = ch;
  }
}

// ---------- 메인 ----------
void setup() {
  Serial.begin(BAUD);
  Wire.begin();
  Wire.setClock(400000);
  loadSettings();
  if (!initPCA()) { Serial.println(F("PCA9685(모터 칩)를 찾을 수 없어요.")); while (true) delay(1000); }
  setMotors(0, 0);
  initEncoders();
  mpuWrite(0x6B, 0x00);
  mpuWrite(0x1A, MECANUM ? 0x04 : 0x03);
  mpuWrite(0x1B, 0x00);
  mpuWrite(0x1C, 0x00);
  delay(100);
  float ax, az, gy;
  if (!readMPU(ax, az, gy)) { Serial.println(F("MPU6050을 찾을 수 없어요.")); while (true) delay(1000); }
  Serial.println(F("자이로 보정 중... 로봇을 움직이지 마세요 (약 1초)"));
  calibrateGyro();
  readMPU(ax, az, gy);
  angle = accelAngle(ax, az);
  printHelp();
  printValues();
  lastMicros = micros();
}

void loop() {
  readSerial();
  unsigned long now = micros();
  if (now - lastMicros < LOOP_US) return;
  float dt = (now - lastMicros) / 1000000.0;
  lastMicros = now;

  float ax, az, gy;
  if (!readMPU(ax, az, gy)) { setMotors(0, 0); return; }
  gyroRate = (gy - gyroOffsetY) * ANGLE_SIGN;
  angle = COMP_ALPHA * (angle + gyroRate * dt) + (1 - COMP_ALPHA) * accelAngle(ax, az);
  gyroD += (gyroRate - gyroD) * D_FILTER;
  yawRate += ((lastGz - gyroOffsetZ) - yawRate) * 0.3;

  long l, r;
  readEncoders(l, r);
  float spd = ((l - lastEncL) + (r - lastEncR)) * 0.5 / COUNTS_PER_REV / dt;
  lastEncL = l; lastEncR = r;
  wheelSpeed += (spd - wheelSpeed) * 0.2;
  wheelPos = ((l + r) * 0.5 - posRef) / COUNTS_PER_REV;

  if (mode != RUN) { autotuneStep(dt, l, r); return; }

  float tilt = angle - S.sp;
  if (fabs(tilt) > FALL_ANGLE) fallen = true;
  if (fallen && fabs(tilt) < RESUME_ANGLE) { fallen = false; integral = 0; posRef = (l + r) / 2; wheelPos = 0; }

  // 조종 명령: 0.4초 동안 새 명령이 없으면 멈춤 (연결이 끊겨도 달려가지 않게)
  if (millis() - lastDriveMs > 400) { driveCmd = 0; turnCmd = 0; }
  float target = (enabled && !fallen) ? driveCmd / 100.0 * DRIVE_SPEED_MAX : 0;
  driveSpd += constrain(target - driveSpd, -DRIVE_ACCEL * dt, DRIVE_ACCEL * dt);
  bool driving = fabs(driveSpd) > 0.02 || fabs(turnCmd) > 1;
  if (driving) { posRef = (l + r) / 2; wheelPos = 0; }   // 달리는 동안은 위치를 붙잡지 않음

  if (!enabled || fallen) {
    output = 0; driveSpd = 0;
    drive(0, 0);
  } else {
    float kv = (driving && S.Kv < DRIVE_KV_MIN) ? DRIVE_KV_MIN : S.Kv;
    output = balanceOut(S.Kp, S.Kd, kv, S.Kx, dt);
    float turn;
    if (fabs(turnCmd) > 1) turn = turnCmd / 100.0 * TURN_PWM_MAX;
    else turn = constrain(S.Ky * yawRate * YAW_SIGN, -YAW_MAX, YAW_MAX);
    drive(output, turn);
  }

  // 상태 출력 (시리얼 플로터·웹앱용). st: 0 모터 꺼짐, 1 넘어짐, 2 균형 잡는 중
  if (millis() - lastPrint >= 100) {
    lastPrint = millis();
    Serial.print(F("angle:")); Serial.print(angle, 2);
    Serial.print(F(" out:")); Serial.print((int)output);
    Serial.print(F(" spd:")); Serial.print(wheelSpeed, 2);
    Serial.print(F(" st:")); Serial.println(!enabled ? 0 : (fallen ? 1 : 2));
  }
}
