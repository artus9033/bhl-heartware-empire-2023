#include <Arduino.h>
#include <Servo.h>
#include "container.h"
#include <string.h>
#include <HX711.h>
#include <LiquidCrystal.h>

#define STR_CHECK(STR1, STR2) (strcmp((STR1), (STR2)) == 0)

const int lcdRS = 12;
const int lcdD4 = 10;
const int lcdD5 = 9;
const int lcdD6 = 8;
const int lcdD7 = 7;

typedef enum containerStateMachine
{
    def,
    uninitialized,
    waiting_for_auth,
    authenticated_opened,
    auth_failed,
    all_picked_up
} contFSM;

typedef enum 
{
    red,
    blue,
    green,
    cyan,
    black
} color;
class container
{
public:
    contFSM state;
    char name[17];
    int unit_weight;
    int RGB_Pins[3];
    Servo myservo;
    int qntAfterAction; // if negative than qntToTake
    HX711 scale;
    long offset;
    long angle_part;
    long sodaCanWeight = 12925;
    LiquidCrystal lcd;
    int requestedAmount;
    

    container(int servo_pin, int _HX_DT_pin, int _HX_SCK_pin, int R, int G, int B, int lcd_EN);
    container();
    ~container();

    void init_unit(char *_name, uint8_t _unit_weight);
    void calibrate();
    void calibrate_empty();
    long measureWeight();
    void SetQnt(int qnt);
    int getAmount();
    void update();
    void setLed(color arg);

    void open();
    void wrongID();
    void close();
};

enum commands{
  no_op = 0,
  init_unit = 0x10,
  calibrate,
  take_out,
  put_in,
  auth_result,

  unlock = 0x15,
  request_amount = 0x17,
  lock,

  request_auth = 0xa0,
  unit_closed,
  cmd_debug,
  amount_ret
};

#define NR_OF_CONTAINERS 1

container containers[NR_OF_CONTAINERS];

template <class T>
void debug(T msg)
{
  Serial.print(char(cmd_debug));
  Serial.print(msg);
}

void setup() {
    Serial.begin(9600);
    containers[0] = container(3, A0, A1, 6, 5, 4, 11);
    debug("Booted\n\r");
}

// void readCmd(char *buf, int size, uint32_t timeout){
//   uint32_t startTime = millis();
//   int i = 0;
//   while(millis() - startTime < timeout){
//     if(Serial.available()){
//       delay(50);
//       while (Serial.available()){
//         buf[i] = Serial.read();
//         i++;
//         if(i == size)
//           return;
//       }
//     }
//   }
// }




void loop() {  
  // char cmdBuf[20];
  // for(int i = 0; i<20; i++){
  //   cmdBuf[i] = 0;
  // }
  // readCmd(cmdBuf, 20, 200);
  if(Serial.available()){
    delay(50);
    int cmd = Serial.read();
    if(cmd != 0){
      bool isValidCmd = true;
      int cid = Serial.read();
      int amount = 0;
      switch (cmd)
      {
      case init_unit:
        char name[16];
        for (size_t ii = 0; ii < 16; ii++)
        {
          name[ii] = Serial.read();
        }
        containers[cid].init_unit(name, Serial.read());
        break;
      case calibrate:
        containers[cid].calibrate();
        break;
      case take_out:
        containers[cid].SetQnt(-Serial.read());
        break;
      case put_in:
        containers[cid].SetQnt(Serial.read());
        break;
      case unlock:
        containers[cid].open();
        break;
      case lock:
        containers[cid].close();
        break;
      case request_amount:
        amount = containers[cid].getAmount();
        debug("Amount = ");
        debug(amount);
        debug("\n\r");
        break;
      default:
        isValidCmd = false;
        Serial.print(char(0x55));
        break;
      }
      if(isValidCmd){
        Serial.print(char(0xaa));
      }
      if(cmd == request_amount){
        Serial.print(char(amount_ret));
        Serial.print(char(cid));
        Serial.print(char(amount));
      }
    }
  }

  static unsigned long prevTime;
  unsigned long curTime = millis();
  if(curTime-prevTime > 500){
    prevTime = curTime;
    for (size_t cid = 0; cid < NR_OF_CONTAINERS; cid++)
    {
      containers[cid].update();
    }
  }
  

}

// void loop() {  
//   char cmdBuf[20];
//   for(int i = 0; i<20; i++){
//     cmdBuf[i] = 0;
//   }
//   readCmd(cmdBuf, 18, 200);
//   if(cmdBuf[0] != 0){
//     switch (cmdBuf[0])
//     {
//     case 0x10:
//       Serial.print(char(0xaa));
//       break;
//     case 0x11:
//       Serial.print(char(0xaa));
//       break;
//     case 0x12:
//       Serial.print(char(0xaa));
//       break;
//     case 0x13:
//       Serial.print(char(0xaa));
//       int cid = cmdBuf[1];
//       delay(230);
//       Serial.print(char(0xa0));
//       Serial.print(char(cid));
//       Serial.print(char(0x62));
//       Serial.print(char(0x6e));
//       Serial.print(char(0x65));
//       Serial.print(char(0x6a));
//       Serial.print(char(0xaa));
//       delay(500);
//       Serial.print(char(0xa0));
//       Serial.print(char(cid));
//       Serial.print(char(0x52));
//       Serial.print(char(0x0e));
//       Serial.print(char(0xf5));
//       Serial.print(char(0x1a));
//       Serial.print(char(0xaa));
//       delay(500);
//       Serial.print(char(0xa1));
//       Serial.print(char(cid));
//       break;
//     case 0x14:
//       Serial.print(char(0xaa));
//       break;
    
//     default:
//       Serial.print(char(0x55));
//       break;
//     }
//   }
// }

// void loop() {
//     if (mfrc522.PICC_IsNewCardPresent() && mfrc522.PICC_ReadCardSerial()) {
//       Serial.print(F("Reader "));
//       Serial.print(1);
//       // Show some details of the PICC (that is: the tag/card)
//       Serial.print(F(": Card UID:"));
//       dump_byte_array(mfrc522.uid.uidByte, mfrc522.uid.size);
//       Serial.println();
//       Serial.print(F("PICC type: "));
//       MFRC522::PICC_Type piccType = mfrc522.PICC_GetType(mfrc522.uid.sak);
//       Serial.println(mfrc522.PICC_GetTypeName(piccType));

//       // Halt PICC
//       mfrc522.PICC_HaltA();
//       // Stop encryption on PCD
//       mfrc522.PCD_StopCrypto1();
//     } //if (mfrc522[reader].PICC_IsNewC
// }

// //test Serial
// void loop() {
//   char readStr[256];
//   if(Serial.available()){
//     delay(50);
//     int i = 0;
//     while (Serial.available()){
//       readStr[i] = Serial.read();
//       Serial.print(readStr[i]);
//       i++;
//     }
//     if((readStr[0] == 0x11) && (readStr[1] == 0)){
//       Serial.println("\n\n\n");
//       Serial.println("8======D");
//     }
//   }
// }

container::container(int servo_pin, int _HX_DT_pin, int _HX_SCK_pin, int R, int G, int B, int lcd_EN)
{
    state = uninitialized;
    scale.begin(_HX_DT_pin, _HX_SCK_pin);
    calibrate_empty();
    debug("Offset = ");
    debug(offset);
    debug("\n\r");
    myservo.attach(servo_pin, 600, 2300);
    lcd.init(1, lcdRS, 255, lcd_EN, lcdD4, lcdD5, lcdD6, lcdD7, 0, 0, 0, 0);
    lcd.begin(16, 2);
    debug("lcd init/begin\n\r");
    lcd.print("hello world!");
    RGB_Pins[0] = R;
    RGB_Pins[1] = G;
    RGB_Pins[2] = B;
    setLed(black);
    pinMode(R, OUTPUT);
    pinMode(G, OUTPUT);
    pinMode(B, OUTPUT);
    close();
    debug("Servo closed\n\r");
}

long container::measureWeight()
{
  scale.read();
  delay(100);
  long result = (scale.read()-offset)*sodaCanWeight/angle_part;
  return result;
}

container::container()
{

}

void container::calibrate_empty()
{
  long acc = 0;
  for (size_t i = 0; i < 10; i++)
  {
    acc += scale.read();
    delay(100);
  }
  offset = acc/10;

}
void container::calibrate()
{
  long acc = 0;
  for (size_t i = 0; i < 10; i++)
  {
    acc += scale.read()-offset;
    delay(100);
  }
  angle_part = acc/10;
}

container::~container()
{
}

void container::SetQnt(int qnt)
{
    requestedAmount = getAmount() + qnt*unit_weight;
    state = waiting_for_auth;

}


int container::getAmount()
{
  long temp = measureWeight();
  float amount = float(temp)/float(unit_weight);
  return round(amount);
}

void container::wrongID()
{

}

void container::setLed(color arg)
{
  digitalWrite(RGB_Pins[0], 1);
  digitalWrite(RGB_Pins[1], 1);
  digitalWrite(RGB_Pins[2], 1);
  switch (arg)
  {
  case red:
    digitalWrite(RGB_Pins[0], 0);
    break;
  case green:
    digitalWrite(RGB_Pins[1], 0);
    break;
  case blue:
    digitalWrite(RGB_Pins[2], 0);
    break;
  case cyan:
    digitalWrite(RGB_Pins[1], 0);
    digitalWrite(RGB_Pins[2], 0);
    break;
  black:
  default:
    break;
  }
}

void container::init_unit(char *_name, uint8_t _unit_weight)
{
    lcd.setCursor(0,0);
    for(int i = 0; i<16; i++){
        name[i] = _name[i];
        lcd.print((name[i]==0)?' ':name[i]);
    }
    name[16] = 0;
    debug(name);
    debug("\n\r");
    unit_weight = _unit_weight*1000;
    debug("Unit weight = ");
    debug(unit_weight);
    debug("\n\r");
    lcd.setCursor(0,0);
    lcd.print(name);
    state = def;
}

void container::update()
{
  if(state == uninitialized)
    return;

  int amount = getAmount();

  if(state == authenticated_opened){
    lcd.setCursor(0,1);
    lcd.print(requestedAmount-amount);
    lcd.print("    ");
  }
  lcd.setCursor(12, 1);
  lcd.print(amount);
  lcd.print("   ");
}

void container::open()
{
  state = authenticated_opened;
  setLed(green);
  myservo.write(90);

}

void container::close()
{
  myservo.write(180);
  setLed(red);
}