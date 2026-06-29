import { Card, CardContent, Grid, Typography } from "@mui/material";

export interface StatItem {
  label: string;
  value: number | string;
  color?: string;
}

export function DashboardStats({ stats }: { stats: StatItem[] }) {
  return (
    <Grid container spacing={2}>
      {stats.map((s) => (
        <Grid item xs={6} md={3} key={s.label}>
          <Card sx={{ height: "100%" }}>
            <CardContent>
              <Typography variant="overline" color="text.secondary">
                {s.label}
              </Typography>
              <Typography variant="h4" sx={{ color: s.color ?? "text.primary" }}>
                {s.value}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
}
