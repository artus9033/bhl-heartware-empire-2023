#include "container.h"


container::container(uint8_t _cid, int rfid_ss_pin, int rfid_rst_pin, int servo_pin)
{
    state = def;
    cid = _cid;
    
    mfrc522.PCD_Init(rfid_ss_pin, rfid_rst_pin); // Init each MFRC522 card
    Serial.print(F("Reader "));
    Serial.print(1);
    Serial.print(F(": "));
    mfrc522.PCD_DumpVersionToSerial();
    myservo.attach(servo_pin, 600, 2300);
}

container::container()
{

}

container::~container()
{
}

void container::SetQnt(int qnt)
{
    qntToPut = qnt;
    state = waiting_for_auth;
}

void container::calibrate()
{

}

bool container::RFID_checkFlag()
{
   return  mfrc522.PICC_IsNewCardPresent() && mfrc522.PICC_ReadCardSerial();
}

void container::RFID_getID(char *id)
{
    for (size_t i = 0; i < 4; i++)
    {
        id[i] = mfrc522.uid.uidByte[i];
    }
    // Halt PICC
    mfrc522.PICC_HaltA();
    // Stop encryption on PCD
    mfrc522.PCD_StopCrypto1();
}

void container::wrongID()
{

}

void container::init_unit(char *_name, uint8_t _unit_weight)
{
    for(int i = 0; i<16; i++){
        name[i] = _name[i];
    }
    unit_weight = _unit_weight;
}

void container::open()
{
    myservo.write(0);
}

void container::close()
{
    myservo.write(180);
}