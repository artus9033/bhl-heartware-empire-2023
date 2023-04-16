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
    waiting_for_auth,
    authenticated_opened,
    auth_failed,
    all_picked_up
} contFSM;

class container
{
public:
    contFSM state;
    char name[17];
    uint8_t unit_weight;
    int RGB_Pins[3];
    Servo myservo;
    int qntToPut; // if negative than qntToTake
    HX711 scale;
    long offset;
    long angle_part;
    long sodaCanWeight = 12925;
    LiquidCrystal lcd;
    

    container(int servo_pin, int _HX_DT_pin, int _HX_SCK_pin, int R, int G, int B, int lcd_EN);
    container();
    ~container();

    void init_unit(char *_name, uint8_t _unit_weight);
    void calibrate();
    void calibrate_empty();
    long measureWeight();
    void SetQnt(int qnt);

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

  request_auth = 0xa0,
  unit_closed,
  cmd_debug
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
    Serial.begin(115200);
    containers[0] = container(3, A0, A1, 0, 0, 0, 11);
    debug("Booted\n");
}

void readCmd(char *buf, int size, uint32_t timeout){
  uint32_t startTime = millis();
  int i = 0;
  while(millis() - startTime < timeout){
    if(Serial.available()){
      delay(50);
      while (Serial.available()){
        buf[i] = Serial.read();
        i++;
        if(i == size)
          return;
      }
    }
  }
}




void loop() {  
  char cmdBuf[20];
  for(int i = 0; i<20; i++){
    cmdBuf[i] = 0;
  }
  readCmd(cmdBuf, 18, 200);
  if(cmdBuf[0] != 0){
    bool isValidCmd = true;
    int cid = cmdBuf[1];
    switch (cmdBuf[0])
    {
    case init_unit:
      containers[cid].init_unit(cmdBuf+2, cmdBuf[18]);
      break;
    case calibrate:
      containers[cid].calibrate();
      break;
    case take_out:
      cmdBuf[2] = -cmdBuf[2];
    case put_in:
      containers[cid].SetQnt(cmdBuf[2]);
      break;
    
    default:
      isValidCmd = false;
      Serial.print(char(0x55));
      break;
    }
    if(isValidCmd){
      Serial.print(char(0xaa));
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
    state = def;
    scale.begin(_HX_DT_pin, _HX_SCK_pin);
    calibrate_empty();
    debug("Offset = ");
    debug(offset);
    debug('\n');
    myservo.attach(servo_pin, 600, 2300);
    open();
    delay(1000);
    close();
    delay(1000);
    open();
    debug("Servo closed\n");
    lcd.init(1, lcdRS, 255, lcd_EN, lcdD4, lcdD5, lcdD6, lcdD7, 0, 0, 0, 0);
    lcd.begin(16, 2);
    debug("lcd init/begin\n");
    lcd.print("hello world!");
}

long container::measureWeight()
{
  return (scale.read()-offset)*sodaCanWeight/angle_part;
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
    delay(500);
  }
  offset = acc/10;

}
void container::calibrate()
{
  long acc = 0;
  for (size_t i = 0; i < 10; i++)
  {
    acc += scale.read()-offset;
    delay(500);
  }
  angle_part = acc/10;
}

container::~container()
{
}

void container::SetQnt(int qnt)
{
    qntToPut = qnt;
    state = waiting_for_auth;
}



void container::wrongID()
{

}

void container::init_unit(char *_name, uint8_t _unit_weight)
{
    for(int i = 0; i<16; i++){
        name[i] = _name[i];
    }
    name[16] = 0;
    debug(name);
    debug("\n");
    unit_weight = _unit_weight;
}

void container::open()
{
    myservo.write(0);
}

void container::close()
{
    myservo.write(90);
}