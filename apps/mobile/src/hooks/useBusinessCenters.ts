import { useEffect, useMemo, useState } from 'react';

import { listBusinessCenters } from '../api/dashboard';
import { useOwnerSessionContext } from '../context/OwnerSessionProvider';

export function useBusinessCenters(): Array<{ id: string; name: string }> {
  const { dashboard } = useOwnerSessionContext();
  const organizationId = dashboard?.organization?.id ?? null;
  const businessCenterId = dashboard?.businessCenter?.id ?? null;
  const businessCenterName = dashboard?.businessCenter?.name ?? null;
  const [businessCenters, setBusinessCenters] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    if (!organizationId) {
      setBusinessCenters([]);
      return;
    }

    listBusinessCenters(organizationId)
      .then(setBusinessCenters)
      .catch(() => {
        setBusinessCenters(
          businessCenterId && businessCenterName
            ? [{ id: businessCenterId, name: businessCenterName }]
            : [],
        );
      });
  }, [organizationId]);

  return useMemo(() => {
    if (businessCenters.length > 0) {
      return businessCenters;
    }

    if (businessCenterId && businessCenterName) {
      return [{ id: businessCenterId, name: businessCenterName }];
    }

    return [];
  }, [businessCenterId, businessCenterName, businessCenters]);
}
