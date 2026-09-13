export type BodsParsed = {
  Siri: {
    ServiceDelivery: {
      VehicleMonitoringDelivery: {
        VehicleActivity: Array<{
          RecordedAtTime?: string;
          MonitoredVehicleJourney?: {
            LineRef?: string;
            DirectionRef?: string;
            OperatorRef?: string;
            OriginName?: string;
            DestinationName?: string;
            VehicleRef?: string;
            Bearing?: string;
            VehicleLocation?: {
              Latitude?: string;
              Longitude?: string;
            };
            FramedVehicleJourneyRef?: {
              DatedVehicleJourneyRef?: string;
            };
          };
        }>;
      };
    };
  };
};

export type CompactVehicle = [
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  number,
  number,
  number,
  string | null,
  string,
  string
];

export type CompactVehicleData = {
  version: 1;
  fields: string[];
  vehicles: CompactVehicle[];
};

export type CompactVehicleV2 = [
  string,
  string,
  number,
  string,
  string,
  number,
  number,
  number,
  string | null,
  string,
  string
];

export type CompactVehicleDataV2 = {
  version: 2;
  directions: string[];
  fields: string[];
  operator_names: Record<string, string>;
  operators: Record<string, CompactVehicleV2[]>;
};

export type CompactVehicleV3 = [
  string,
  string,
  number,
  string,
  string,
  number,
  number,
  number,
  string | null,
  number,
  string,
  string
];

export type CompactVehicleDataV3 = {
  version: 3;
  dates: string[];
  directions: string[];
  fields: string[];
  operator_names: Record<string, string>;
  operators: Record<string, CompactVehicleV3[]>;
};

export type CompactVehicleV4 = [
  string,
  string,
  number,
  string,
  number,
  number,
  number,
  number,
  string | null,
  number,
  string,
  string
];

export type CompactVehicleDataV4 = {
  version: 4;
  dates: string[];
  directions: string[];
  destinations: string[];
  fields: string[];
  operator_names: Record<string, string>;
  operators: Record<string, CompactVehicleV4[]>;
};
