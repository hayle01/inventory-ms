import type { CreateUnitRequest, UnitDto, UpdateUnitRequest } from '@inventory-ms/contracts';
import { useCrudResource } from '@/lib/useCrudResource';

export function useUnits() {
  return useCrudResource<UnitDto, CreateUnitRequest, UpdateUnitRequest>('units', '/api/v1/units');
}
