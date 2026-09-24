export type BookingContact = { address: string; phone: string };

export const DEFAULT_BOOKING_CONTACT: BookingContact = {
  address: "Námestie Slobody 2675, 093 01 Vranov nad Topľou",
  phone: "+421918531257",
};

const DEFAULT_MAP_URL =
  "https://www.google.com/maps/place//data=!4m2!3m1!1s0x473ec9fdc5a0e2af:0xe01e0130bd39b872";

export function bookingMapUrl(address: string): string {
  if (address === DEFAULT_BOOKING_CONTACT.address) return DEFAULT_MAP_URL;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}
