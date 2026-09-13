export function encodeOccupancy(occupancy: string): number {
  switch (occupancy) {
    case "":
      return 0;
    case "seatsAvailable":
      return 1;
    case "standingAvailable":
      return 2;
    case "full":
      return 3;
    default:
      throw new Error(`Unknown occupancy value: ${occupancy}`);
  }
}

export function decodeOccupancy(value: number): string {
  switch (value) {
    case 0:
      return "";
    case 1:
      return "seatsAvailable";
    case 2:
      return "standingAvailable";
    case 3:
      return "full";
    default:
      throw new Error(`Unknown occupancy code: ${value}`);
  }
}
