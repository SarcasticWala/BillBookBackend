import { env } from "../../config/env";
import { IrpAdapter } from "./IrpAdapter";
import { mockIrpAdapter } from "./mockIrpAdapter";
import { nicIrpAdapter } from "./nicIrpAdapter";

export function getIrpAdapter(): IrpAdapter {
  return env.eInvoice.provider === "NIC" ? nicIrpAdapter : mockIrpAdapter;
}

export * from "./IrpAdapter";
