import CancelIcon from "@mui/icons-material/Cancel";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { Alert, AlertTitle, Box, Chip, Stack } from "@mui/material";
import type { EligibilityResult } from "../types";

export function EligibilityResultCard({ result }: { result: EligibilityResult }) {
  const pd = result.priceDrop;

  return (
    <Alert
      severity={result.eligible ? "success" : "warning"}
      icon={result.eligible ? <CheckCircleIcon /> : <CancelIcon />}
      variant="outlined"
    >
      <AlertTitle>
        {result.eligible ? "Eligible for compensation" : "Not eligible"}
      </AlertTitle>
      <Stack spacing={1}>
        <Box>{result.reason}</Box>

        {pd && (
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {pd.paidPrice != null && (
              <Chip variant="outlined" label={`Paid: US$ ${pd.paidPrice}`} />
            )}
            {pd.currentPrice != null && (
              <Chip
                variant="outlined"
                color={pd.dropped ? "success" : "default"}
                label={`Current: US$ ${pd.currentPrice}`}
              />
            )}
            {pd.matched && (
              <Chip
                size="small"
                variant="outlined"
                label={`Matched ${pd.matchedFlightNumbers.join(" + ")}`}
              />
            )}
          </Stack>
        )}

        {result.eligible && result.estimatedCompensation > 0 && (
          <Chip
            color="success"
            label={
              pd
                ? `Potential refund: US$ ${result.estimatedCompensation}`
                : `Estimated compensation: US$ ${result.estimatedCompensation}`
            }
            sx={{ alignSelf: "flex-start" }}
          />
        )}
      </Stack>
    </Alert>
  );
}
