package bo.pasorapa.hato.service.filter.filters;

import io.quarkus.runtime.annotations.RegisterForReflection;
import java.io.Serializable;

@RegisterForReflection
public class EnumFilter<T extends Enum<T> & Serializable> extends Filter<T> {
}
