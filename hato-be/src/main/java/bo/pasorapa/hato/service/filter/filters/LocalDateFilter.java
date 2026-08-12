package bo.pasorapa.hato.service.filter.filters;

import io.quarkus.runtime.annotations.RegisterForReflection;
import java.time.LocalDate;

@RegisterForReflection
public class LocalDateFilter extends RangeFilter<LocalDate> {
}
